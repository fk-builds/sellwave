import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { linePrice } from './cart.js';
import { loyaltyConfig } from '../utils/loyalty.js';
import { sendEmail, orderConfirmationEmail, notifyOwnerNewOrder } from '../utils/email.js';
import { assessOrderRisk, runLowStockCheck, createOpsNotification, emailOwner } from '../utils/ops.js';
import { estimateShipping } from '../utils/shippingCalc.js';

const r = Router();
r.use(requireAuth);

r.get('/', async (req, res) =>
  res.json(await prisma.order.findMany({ where: { userId: req.auth!.id }, include: { items: true }, orderBy: { createdAt: 'desc' } })),
);

r.get('/:orderNumber', async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { orderNumber: String(req.params.orderNumber), userId: req.auth!.id },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  res.json(order);
});

r.post('/checkout', async (req, res, next) => {
  try {
    const d = z.object({
      addressId: z.string(),
      paymentMethod: z.enum(['COD', 'BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA']),
      notes: z.string().max(500).optional(),
      couponCode: z.string().trim().toUpperCase().max(40).optional(),
      redeemPoints: z.coerce.number().int().min(0).optional(),
      paymentReference: z.string().trim().max(60).optional(),
    }).parse(req.body);

    const userId = req.auth!.id;
    const [address, items, user, loyalty] = await Promise.all([
      prisma.address.findFirst({ where: { id: d.addressId, userId } }),
      prisma.cartItem.findMany({ where: { userId }, include: { product: true, variant: true } }),
      prisma.user.findUnique({ where: { id: userId } }),
      loyaltyConfig(),
    ]);

    if (!address) return res.status(400).json({ message: 'Please select a saved delivery address.' });
    if (!items.length) return res.status(400).json({ message: 'Your cart is empty.' });
    for (const i of items) {
      const available = i.variant ? i.variant.stockQuantity : i.product.stockQuantity;
      if (i.product.status !== 'ACTIVE' || (i.variant && !i.variant.isActive) || available < i.quantity) {
        return res.status(400).json({ message: `${i.product.name}${i.variant ? ` (${i.variant.name})` : ''} is no longer available in the requested quantity.` });
      }
    }

    const subtotal = items.reduce((sum, i) => sum + linePrice(i.product, i.variant) * i.quantity, 0);

    // ---- Coupon discount ----
    let couponDiscount = 0;
    let couponId: string | undefined;
    if (d.couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: d.couponCode } });
      const now = new Date();
      if (!coupon || !coupon.isActive
        || (coupon.startsAt && coupon.startsAt > now)
        || (coupon.endsAt && coupon.endsAt < now)
        || (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
        || (coupon.minimumOrderAmount && subtotal < Number(coupon.minimumOrderAmount))) {
        return res.status(400).json({ message: 'This coupon is not valid for this order.' });
      }
      if (await prisma.couponRedemption.findUnique({ where: { couponId_userId: { couponId: coupon.id, userId } } })) {
        return res.status(400).json({ message: 'This coupon has already been used on your account.' });
      }
      couponDiscount = coupon.type === 'PERCENT' ? subtotal * (Number(coupon.value) / 100) : Number(coupon.value);
      if (coupon.maximumDiscountAmount) couponDiscount = Math.min(couponDiscount, Number(coupon.maximumDiscountAmount));
      couponDiscount = Math.min(couponDiscount, subtotal);
      couponId = coupon.id;
    }

    // ---- Loyalty points redemption (1 point = redeemValuePkr, capped at maxRedeemShare of subtotal) ----
    let pointsUsed = 0;
    let pointsDiscount = 0;
    const requestedPoints = d.redeemPoints ?? 0;
    if (requestedPoints > 0) {
      if (!user) return res.status(401).json({ message: 'Please sign in to continue.' });
      if (requestedPoints > user.loyaltyPoints) return res.status(400).json({ message: 'You do not have enough loyalty points.' });
      const maxDiscount = Math.floor(subtotal * loyalty.maxRedeemShare);
      pointsDiscount = Math.min(requestedPoints * loyalty.redeemValuePkr, maxDiscount);
      pointsUsed = Math.floor(pointsDiscount / loyalty.redeemValuePkr);
      pointsDiscount = pointsUsed * loyalty.redeemValuePkr;
    }

    const discount = Math.min(couponDiscount + pointsDiscount, subtotal);
    const totalWeight = items.reduce((s, i) => s + (i.product.weightGrams ?? 500) * i.quantity, 0);
    const shipEst = await estimateShipping(address.city, totalWeight);
    const shipping = shipEst.amount ?? 0;

    const order = await prisma.$transaction(async tx => {
      const o = await tx.order.create({
        data: {
          orderNumber: `SW-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
          userId,
          paymentMethod: d.paymentMethod,
          riskScore: 0,
          subtotal,
          shippingAmount: shipping,
          discountAmount: discount,
          totalAmount: subtotal + shipping - discount,
          couponCode: d.couponCode,
          pointsRedeemed: pointsUsed,
          paymentReference: d.paymentReference ?? null,
          shippingName: address.recipientName,
          shippingPhone: address.phone,
          shippingAddress: { label: address.label, line1: address.line1, line2: address.line2, city: address.city, province: address.province, postalCode: address.postalCode },
          notes: d.notes,
          items: {
            create: items.map(i => ({
              productId: i.productId,
              productName: i.product.name,
              variantName: i.variant?.name ?? null,
              variantSku: i.variant?.sku ?? null,
              sku: i.variant?.sku ?? i.product.sku,
              unitPrice: linePrice(i.product, i.variant),
              quantity: i.quantity,
              lineTotal: linePrice(i.product, i.variant) * i.quantity,
            })),
          },
        },
      });
      for (const i of items) {
        if (i.variant) {
          await tx.productVariant.update({ where: { id: i.variant.id }, data: { stockQuantity: { decrement: i.quantity } } });
        } else {
          await tx.product.update({ where: { id: i.productId }, data: { stockQuantity: { decrement: i.quantity } } });
        }
        // Smart bundle: components ka stock bhi kam karo
        const bundle = i.product.bundleItems as { productId: string; qty: number }[] | null;
        if (Array.isArray(bundle)) {
          for (const comp of bundle) {
            await tx.product.update({ where: { id: comp.productId }, data: { stockQuantity: { decrement: (comp.qty || 1) * i.quantity } } });
          }
        }
      }
      if (couponId) {
        await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
        await tx.couponRedemption.create({ data: { couponId, userId, orderId: o.id } });
      }
      if (pointsUsed > 0) {
        await tx.user.update({ where: { id: userId }, data: { loyaltyPoints: { decrement: pointsUsed } } });
        await tx.loyaltyTransaction.create({ data: { userId, orderId: o.id, type: 'REDEEM', points: -pointsUsed, note: `Redeemed on order ${o.orderNumber}` } });
      }
      await tx.cartItem.deleteMany({ where: { userId } });
      return o;
    });

    // ---- Fraud & Order Risk Guard (never blocks checkout) ----
    try {
      const risk = await assessOrderRisk({
        userId,
        accountCreatedAt: user?.createdAt ?? new Date(),
        paymentMethod: d.paymentMethod,
        subtotal,
        maxLineQty: Math.max(...items.map(i => i.quantity)),
      });
      if (risk.needsVerification) {
        await prisma.order.update({
          where: { id: order.id },
          data: { riskScore: risk.score, riskFlags: risk.flags, needsVerification: true },
        });
        await createOpsNotification({
          kind: 'ALERT',
          category: 'FRAUD',
          severity: 'WARNING',
          title: `Risk order ${order.orderNumber} — verify before processing`,
          body: `Risk score ${risk.score}. Flags: ${risk.flags.join('; ')}. Customer verification (call/WhatsApp) recommended before dispatch.`,
          payload: { orderId: order.id, orderNumber: order.orderNumber, score: risk.score, flags: risk.flags },
        });
        void emailOwner(
          `Risk order ${order.orderNumber} — verification needed`,
          `<p>Risk score <b>${risk.score}</b></p><ul>${risk.flags.map(f => `<li>${f}</li>`).join('')}</ul><p>Admin panel → AI Ops me review karein. Order pending par hai — call/WhatsApp se verify karein.</p>`,
        );
      }
    } catch { /* risk guard must never block a checkout */ }

    // Low-stock agent — fire and forget
    void runLowStockCheck().catch(() => {});

    // Order confirmation email — fire and forget, never blocks the order.
    const storeSetting = d.paymentMethod === 'BANK_TRANSFER'
      ? (await prisma.siteSetting.findUnique({ where: { key: 'store' } }))?.value as { bank?: { accountTitle?: string; bankName?: string; accountNumber?: string; iban?: string } } | null
      : null;
    const bank = storeSetting?.bank ?? null;
    if (user) {
      void sendEmail({
        to: user.email,
        subject: `Order ${order.orderNumber} received — Sell Wave`,
        html: orderConfirmationEmail({
          orderNumber: order.orderNumber,
          to: user.email,
          customerName: user.firstName,
          items: items.map(i => ({ productName: i.product.name, variantName: i.variant?.name ?? null, quantity: i.quantity, lineTotal: linePrice(i.product, i.variant) * i.quantity })),
          subtotal,
          discountAmount: discount,
          shippingAmount: shipping,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          bank,
        }),
      });
      void notifyOwnerNewOrder({
        orderNumber: order.orderNumber,
        to: user.email,
        customerName: `${user.firstName} ${user.lastName}`,
        items: items.map(i => ({ productName: i.product.name, variantName: i.variant?.name ?? null, quantity: i.quantity, lineTotal: linePrice(i.product, i.variant) * i.quantity })),
        subtotal,
        discountAmount: discount,
        shippingAmount: shipping,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
      });
    }

    res.status(201).json(order);
  } catch (e) { next(e); }
});

export default r;
