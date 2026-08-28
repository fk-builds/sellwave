import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { loyaltyConfig } from '../utils/loyalty.js';
import { sendEmail, orderStatusEmail } from '../utils/email.js';

const r = Router();
r.use(requireAuth, requireRole('ADMIN', 'STAFF'));

const category = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const product = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  sku: z.string().min(1),
  categoryId: z.string(),
  price: z.coerce.number().nonnegative(),
  compareAtPrice: z.coerce.number().nonnegative().optional(),
  stockQuantity: z.coerce.number().int().nonnegative(),
  weightGrams: z.coerce.number().int().positive().optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  isFeatured: z.boolean().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
});

const variant = z.object({
  name: z.string().min(1).max(60),
  sku: z.string().max(60).optional(),
  price: z.coerce.number().nonnegative().optional(),
  stockQuantity: z.coerce.number().int().nonnegative().default(0),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const audit = (actorId: string, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) =>
  prisma.auditLog.create({ data: { actorId, action, entity, entityId, metadata: metadata as never } });

r.get('/dashboard', async (_q, res) => {
  const [products, orders, customers, pendingOrders, pendingReviews, pendingReturns] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.review.count({ where: { isApproved: false } }),
    prisma.returnRequest.count({ where: { status: 'REQUESTED' } }),
  ]);
  res.json({ products, orders, customers, pendingOrders, pendingReviews, pendingReturns });
});

// ---------- Categories ----------
r.get('/categories', async (_q, res) => res.json(await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } })));
r.post('/categories', async (req, res, next) => {
  try {
    const c = await prisma.category.create({ data: category.parse(req.body) });
    await audit(req.auth!.id, 'CREATE', 'Category', c.id);
    res.status(201).json(c);
  } catch (e) { next(e); }
});

// ---------- Products ----------
r.get('/products', async (_q, res) =>
  res.json(await prisma.product.findMany({
    include: { category: true, images: { orderBy: { sortOrder: 'asc' } }, variants: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  })),
);

r.post('/products', async (req, res, next) => {
  try {
    const d = product.parse(req.body);
    const p = await prisma.product.create({ data: d });
    await audit(req.auth!.id, 'CREATE', 'Product', p.id);
    res.status(201).json(p);
  } catch (e) { next(e); }
});

r.patch('/products/:id', async (req, res, next) => {
  try {
    const d = product.partial().parse(req.body);
    const p = await prisma.product.update({ where: { id: String(req.params.id) }, data: d });
    await audit(req.auth!.id, 'UPDATE', 'Product', p.id, d);
    res.json(p);
  } catch (e) { next(e); }
});

// ---------- Product images ----------
r.post('/products/:id/images', async (req, res, next) => {
  try {
    const d = z.object({ url: z.string().url(), alt: z.string().max(160).optional(), sortOrder: z.coerce.number().int().min(0).optional() }).parse(req.body);
    const p = await prisma.product.findUnique({ where: { id: String(req.params.id) } });
    if (!p) return res.status(404).json({ message: 'Product not found.' });
    const image = await prisma.productImage.create({ data: { productId: p.id, url: d.url, alt: d.alt, sortOrder: d.sortOrder ?? 0 } });
    await audit(req.auth!.id, 'ADD_IMAGE', 'Product', p.id);
    res.status(201).json(image);
  } catch (e) { next(e); }
});

r.delete('/products/:id/images/:imageId', async (req, res, next) => {
  try {
    const image = await prisma.productImage.findFirst({ where: { id: String(req.params.imageId), productId: String(req.params.id) } });
    if (!image) return res.status(404).json({ message: 'Image not found.' });
    await prisma.productImage.delete({ where: { id: image.id } });
    await audit(req.auth!.id, 'DELETE_IMAGE', 'Product', String(req.params.id));
    res.status(204).send();
  } catch (e) { next(e); }
});

// ---------- Product variants (size / colour with per-variant stock) ----------
r.post('/products/:id/variants', async (req, res, next) => {
  try {
    const p = await prisma.product.findUnique({ where: { id: String(req.params.id) } });
    if (!p) return res.status(404).json({ message: 'Product not found.' });
    const d = variant.parse(req.body);
    const v = await prisma.productVariant.create({ data: { ...d, productId: p.id } });
    await audit(req.auth!.id, 'ADD_VARIANT', 'Product', p.id, { variantId: v.id });
    res.status(201).json(v);
  } catch (e) { next(e); }
});

r.patch('/variants/:id', async (req, res, next) => {
  try {
    const d = variant.partial().parse(req.body);
    const v = await prisma.productVariant.update({ where: { id: String(req.params.id) }, data: d });
    await audit(req.auth!.id, 'UPDATE_VARIANT', 'ProductVariant', v.id, d);
    res.json(v);
  } catch (e) { next(e); }
});

r.delete('/variants/:id', async (req, res, next) => {
  try {
    await prisma.productVariant.delete({ where: { id: String(req.params.id) } });
    await audit(req.auth!.id, 'DELETE_VARIANT', 'ProductVariant', String(req.params.id));
    res.status(204).send();
  } catch (e) { next(e); }
});

// ---------- Orders ----------
r.get('/orders', async (_q, res) =>
  res.json(await prisma.order.findMany({
    include: { user: { select: { email: true, firstName: true, lastName: true } }, items: true },
    orderBy: { createdAt: 'desc' },
  })),
);

r.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const status = z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']) }).parse(req.body).status;
    const current = await prisma.order.findUnique({ where: { id: String(req.params.id) } });
    if (!current) return res.status(404).json({ message: 'Order not found.' });

    const loyalty = await loyaltyConfig();
    let paymentStatus = current.paymentStatus;

    // Delivered: credit loyalty points once (1 point per earnRatePkr of order total).
    let awardedPoints = 0;
    if (status === 'DELIVERED' && current.status !== 'DELIVERED') {
      const alreadyAwarded = await prisma.loyaltyTransaction.findFirst({ where: { orderId: current.id, type: 'EARN' } });
      if (!alreadyAwarded) {
        awardedPoints = Math.floor(Number(current.totalAmount) / loyalty.earnRatePkr);
        if (awardedPoints > 0) {
          await prisma.user.update({ where: { id: current.userId }, data: { loyaltyPoints: { increment: awardedPoints } } });
          await prisma.loyaltyTransaction.create({ data: { userId: current.userId, orderId: current.id, type: 'EARN', points: awardedPoints, note: `Earned on delivered order ${current.orderNumber}` } });
        }
      }
      if (current.paymentMethod === 'COD') paymentStatus = 'PAID';
    }

    // Cancelled / refunded: reverse redemption and earning exactly once.
    if (status === 'CANCELLED' || status === 'REFUNDED') {
      const redeemed = await prisma.loyaltyTransaction.findFirst({ where: { orderId: current.id, type: 'REDEEM' } });
      const redeemReversed = await prisma.loyaltyTransaction.findFirst({ where: { orderId: current.id, type: 'REDEEM_REVERSAL' } });
      if (redeemed && !redeemReversed) {
        await prisma.user.update({ where: { id: current.userId }, data: { loyaltyPoints: { increment: Math.abs(redeemed.points) } } });
        await prisma.loyaltyTransaction.create({ data: { userId: current.userId, orderId: current.id, type: 'REDEEM_REVERSAL', points: Math.abs(redeemed.points), note: `Points returned — order ${current.orderNumber} ${status.toLowerCase()}` } });
      }
      const earned = await prisma.loyaltyTransaction.findFirst({ where: { orderId: current.id, type: 'EARN' } });
      const earnReversed = await prisma.loyaltyTransaction.findFirst({ where: { orderId: current.id, type: 'EARN_REVERSAL' } });
      if (earned && !earnReversed) {
        await prisma.user.update({ where: { id: current.userId }, data: { loyaltyPoints: { decrement: earned.points } } });
        await prisma.loyaltyTransaction.create({ data: { userId: current.userId, orderId: current.id, type: 'EARN_REVERSAL', points: -earned.points, note: `Earned points reversed — order ${current.orderNumber} ${status.toLowerCase()}` } });
      }
      if (status === 'REFUNDED') paymentStatus = 'REFUNDED';
    }

    const o = await prisma.order.update({ where: { id: current.id }, data: { status, paymentStatus } });
    await audit(req.auth!.id, 'UPDATE_STATUS', 'Order', o.id, { from: current.status, to: status, awardedPoints });

    // Customer status email for meaningful transitions — fire and forget.
    if (['SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].includes(status) && current.status !== status) {
      const full = await prisma.order.findUnique({ where: { id: o.id }, include: { user: { select: { email: true, firstName: true } }, items: true } });
      if (full) {
        void sendEmail({
          to: full.user.email,
          subject: `Order ${full.orderNumber} — ${status.charAt(0)}${status.slice(1).toLowerCase()} · Sell Wave`,
          html: orderStatusEmail({
            orderNumber: full.orderNumber,
            status,
            to: full.user.email,
            customerName: full.user.firstName,
            items: full.items.map(i => ({ productName: i.productName, variantName: i.variantName, quantity: i.quantity, lineTotal: i.lineTotal })),
            subtotal: full.subtotal,
            discountAmount: full.discountAmount,
            shippingAmount: full.shippingAmount,
            totalAmount: full.totalAmount,
            paymentMethod: full.paymentMethod,
            paymentStatus: full.paymentStatus,
          }),
        });
      }
    }

    res.json(o);
  } catch (e) { next(e); }
});

// ---------- Coupons ----------
r.get('/coupons', async (_q, res) => res.json(await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } })));
r.post('/coupons', async (req, res, next) => {
  try {
    const d = z.object({
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]+$/),
      description: z.string().max(200).optional(),
      type: z.enum(['PERCENT', 'FIXED']),
      value: z.coerce.number().positive(),
      minimumOrderAmount: z.coerce.number().nonnegative().optional(),
      maximumDiscountAmount: z.coerce.number().nonnegative().optional(),
      usageLimit: z.coerce.number().int().positive().optional(),
      endsAt: z.string().datetime().optional(),
    }).parse(req.body);
    const c = await prisma.coupon.create({ data: { ...d, endsAt: d.endsAt ? new Date(d.endsAt) : undefined } });
    await audit(req.auth!.id, 'CREATE', 'Coupon', c.id);
    res.status(201).json(c);
  } catch (e) { next(e); }
});
r.patch('/coupons/:id', async (req, res, next) => {
  try {
    const d = z.object({ isActive: z.boolean() }).parse(req.body);
    res.json(await prisma.coupon.update({ where: { id: String(req.params.id) }, data: d }));
  } catch (e) { next(e); }
});

// ---------- Manual payment verification (bank transfer / COD) ----------
r.patch('/orders/:id/payment-status', async (req, res, next) => {
  try {
    const paymentStatus = z.object({ paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']) }).parse(req.body).paymentStatus;
    const o = await prisma.order.update({ where: { id: String(req.params.id) }, data: { paymentStatus } });
    await audit(req.auth!.id, 'UPDATE_PAYMENT_STATUS', 'Order', o.id, { paymentStatus });
    res.json(o);
  } catch (e) { next(e); }
});

// ---------- Store settings (bank account, support info) ----------
r.get('/settings', async (_q, res) => {
  const [setting, headlinesSetting, slidesSetting] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: 'store' } }),
    prisma.siteSetting.findUnique({ where: { key: 'headlines' } }),
    prisma.siteSetting.findUnique({ where: { key: 'homepage_slides' } }),
  ]);
  const sv = (setting?.value ?? {}) as Record<string, unknown>;
  const headlines = Array.isArray(sv.headlines) && (sv.headlines as unknown[]).length
    ? sv.headlines
    : (Array.isArray(headlinesSetting?.value) ? headlinesSetting.value : []);
  const slides = Array.isArray(sv.slides) && (sv.slides as unknown[]).length
    ? sv.slides
    : (Array.isArray(slidesSetting?.value) ? slidesSetting.value : []);
  res.json({ ...sv, headlines, slides });
});

r.patch('/settings', async (req, res, next) => {
  try {
    const slide = z.object({
      image: z.string().max(300),
      eyebrow: z.string().max(60).default(''),
      title1: z.string().max(90).default(''),
      title2: z.string().max(90).default(''),
      copy: z.string().max(220).default(''),
      cta: z.string().max(40).default('Shop now'),
      link: z.string().max(200).default('/shop'),
      active: z.boolean().default(true),
    });
    const d = z.object({
      bank: z.object({
        accountTitle: z.string().max(80).optional(),
        bankName: z.string().max(80).optional(),
        accountNumber: z.string().max(40).optional(),
        iban: z.string().max(40).optional(),
        raastNumber: z.string().max(40).optional(),
        instructions: z.string().max(500).optional(),
      }).optional(),
      freeDeliveryHeadline: z.string().max(160).optional(),
      supportWhatsapp: z.string().max(20).optional(),
      supportEmail: z.string().email().optional(),
      headlines: z.array(z.string().min(1).max(170)).max(10).optional(),
      slides: z.array(slide).min(1).max(12).optional(),
      courier: z.object({
        provider: z.string().max(40).optional(),
        enabled: z.boolean().optional(),
        environment: z.enum(['sandbox', 'production']).optional(),
        apiUrl: z.string().max(200).optional(),
        apiKey: z.string().max(200).optional(),
        apiSecret: z.string().max(200).optional(),
        clientId: z.string().max(120).optional(),
        clientSecret: z.string().max(200).optional(),
        accountCode: z.string().max(60).optional(),
        pickupCity: z.string().max(60).optional(),
        defaultCharges: z.coerce.number().min(0).optional(),
        notes: z.string().max(500).optional(),
      }).optional(),
      payments: z.object({
        jazzcash: z.object({
          enabled: z.boolean().optional(),
          environment: z.enum(['sandbox', 'production']).optional(),
          merchantId: z.string().max(60).optional(),
          password: z.string().max(120).optional(),
          integritySalt: z.string().max(120).optional(),
          returnUrl: z.string().max(200).optional(),
        }).optional(),
        easypaisa: z.object({
          enabled: z.boolean().optional(),
          environment: z.enum(['sandbox', 'production']).optional(),
          storeId: z.string().max(60).optional(),
          hashKey: z.string().max(160).optional(),
          returnUrl: z.string().max(200).optional(),
        }).optional(),
      }).optional(),
    }).parse(req.body);
    const current = await prisma.siteSetting.findUnique({ where: { key: 'store' } });
    const prev = (current?.value ?? {}) as Record<string, unknown>;
    const value: Record<string, unknown> = { ...prev };
    for (const [k, v] of Object.entries(d)) {
      if (v === undefined) continue;
      if (k === 'courier' || k === 'payments' || k === 'bank') {
        value[k] = { ...((prev[k] as Record<string, unknown>) ?? {}), ...(v as Record<string, unknown>) };
      } else {
        value[k] = v;
      }
    }
    const saved = await prisma.siteSetting.upsert({ where: { key: 'store' }, update: { value: value as Prisma.InputJsonValue }, create: { key: 'store', value: value as Prisma.InputJsonValue } });
    await audit(req.auth!.id, 'UPDATE', 'SiteSetting', 'store', d);
    res.json(saved.value);
  } catch (e) { next(e); }
});

export default r;
