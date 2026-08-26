import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { automationConfig, runLowStockCheck, createOpsNotification } from '../utils/ops.js';

const r = Router();
r.use(requireAuth, requireRole('ADMIN', 'STAFF'));

const audit = (actorId: string, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) =>
  prisma.auditLog.create({ data: { actorId, action, entity, entityId, metadata: metadata as never } });

// ---------- Notifications & approvals feed ----------
r.get('/notifications', async (req, res) => {
  const filter = String(req.query.filter || 'all');
  const where =
    filter === 'approvals' ? { kind: 'APPROVAL' } :
    filter === 'alerts' ? { kind: 'ALERT' } :
    {};
  const [notifications, unread] = await Promise.all([
    prisma.adminNotification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.adminNotification.count({ where: { status: 'NEW' } }),
  ]);
  res.json({ notifications, unread });
});

// Approve / reject / mark-read. Approving a PRICING approval executes the price change.
r.patch('/notifications/:id', async (req, res, next) => {
  try {
    const { action } = z.object({ action: z.enum(['read', 'approve', 'reject']) }).parse(req.body);
    const item = await prisma.adminNotification.findUnique({ where: { id: String(req.params.id) } });
    if (!item) return res.status(404).json({ message: 'Notification not found.' });

    if (action === 'read') {
      return res.json(await prisma.adminNotification.update({ where: { id: item.id }, data: { status: item.status === 'NEW' ? 'READ' : item.status } }));
    }

    if (action === 'reject') {
      await prisma.adminNotification.update({ where: { id: item.id }, data: { status: 'REJECTED', resolvedAt: new Date() } });
      await audit(req.auth!.id, 'REJECT', 'AdminNotification', item.id, { category: item.category });
      return res.json({ ok: true, status: 'REJECTED' });
    }

    // approve
    if (item.kind !== 'APPROVAL') {
      await prisma.adminNotification.update({ where: { id: item.id }, data: { status: 'DONE', resolvedAt: new Date() } });
      return res.json({ ok: true, status: 'DONE' });
    }
    const payload = (item.payload ?? {}) as {
      productId?: string; newPrice?: number; compareAtPrice?: number; lowMargin?: boolean; profit?: number;
      bundle?: { name: string; price: number; costPrice: number; compareAtPrice?: number; componentIds: string[] };
    };
    let executed = 'acknowledged';

    if ((item.category === 'PRICING' || item.category === 'LOW_MARGIN') && payload.productId && payload.newPrice !== undefined) {
      const anchor = payload.compareAtPrice && payload.compareAtPrice > payload.newPrice ? payload.compareAtPrice : null;
      await prisma.product.update({
        where: { id: payload.productId },
        data: { price: payload.newPrice, ...(anchor !== null ? { compareAtPrice: anchor } : {}) },
      });
      await audit(req.auth!.id, 'AI_PRICE_APPROVED', 'Product', payload.productId, { newPrice: payload.newPrice, anchor, lowMargin: payload.lowMargin, notification: item.id });
      executed = 'price updated';
    }

    if (item.category === 'BUNDLE' && payload.bundle) {
      const b = payload.bundle;
      const baseSlug = b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
      let slug = baseSlug || `combo-${Date.now()}`;
      if (await prisma.product.findUnique({ where: { slug } })) slug = `${baseSlug}-${Date.now().toString(36)}`;
      const components = await prisma.product.findMany({ where: { id: { in: b.componentIds } }, include: { images: { take: 1 } } });
      const stock = components.length ? Math.min(...components.map(c => c.stockQuantity)) : 0;
      const names = components.map(c => c.name).join(' + ');
      const bundle = await prisma.product.create({
        data: {
          name: b.name,
          slug,
          sku: `SW-COMBO-${Date.now().toString(36).toUpperCase()}`,
          categoryId: components[0]?.categoryId ?? (await prisma.category.findFirst())!.id,
          price: b.price,
          costPrice: b.costPrice,
          compareAtPrice: b.compareAtPrice ?? null,
          stockQuantity: stock,
          shortDescription: `Value combo: ${names}`,
          description: `Is smart bundle me shamil hai:\n${components.map(c => `• ${c.name}`).join('\n')}\n\nEk sath lenay par total zyada kam padta hai — Sell Wave smart pricing.`,
          status: 'ACTIVE',
          bundleItems: b.componentIds.map(id => ({ productId: id, qty: 1 })) as never,
          images: components[0]?.images[0] ? { create: { url: components[0].images[0].url, alt: b.name, sortOrder: 0 } } : undefined,
        },
      });
      await audit(req.auth!.id, 'BUNDLE_APPROVED', 'Product', bundle.id, { components: b.componentIds, price: b.price, notification: item.id });
      executed = 'bundle product created';
    }

    await prisma.adminNotification.update({ where: { id: item.id }, data: { status: 'DONE', resolvedAt: new Date() } });
    await audit(req.auth!.id, 'APPROVE', 'AdminNotification', item.id, { category: item.category, executed });
    res.json({ ok: true, status: 'DONE', executed });
  } catch (e) { next(e); }
});

// ---------- Automation settings ----------
r.get('/settings', async (_q, res) => res.json(await automationConfig()));

r.put('/settings', async (req, res, next) => {
  try {
    const d = z.object({
      lowStockThreshold: z.coerce.number().int().min(0),
      codMaxOrderValue: z.coerce.number().min(0),
      fraudCancelledLimit: z.coerce.number().int().min(0),
      fraudMinAccountHours: z.coerce.number().min(0),
      fraudScoreThreshold: z.coerce.number().min(1),
      autoHighlightPositiveReviews: z.boolean(),
    }).parse(req.body);
    const current = await prisma.siteSetting.findUnique({ where: { key: 'automation' } });
    const value = { ...(current?.value as Record<string, unknown> | null ?? {}), ...d };
    await prisma.siteSetting.upsert({ where: { key: 'automation' }, update: { value: value as never }, create: { key: 'automation', value: value as never } });
    await audit(req.auth!.id, 'UPDATE', 'AutomationSettings', 'automation', d);
    res.json(d);
  } catch (e) { next(e); }
});

// ---------- Agents ----------
r.post('/run-checks', async (_req, res) => {
  const created = await runLowStockCheck();
  res.json({ ok: true, newLowStockAlerts: created });
});

r.get('/lowstock', async (_q, res) => {
  const config = await automationConfig();
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    include: { variants: { where: { isActive: true } } },
  });
  const low = products
    .map(p => ({ id: p.id, name: p.name, sku: p.sku, stock: p.variants.length > 0 ? p.variants.reduce((s, v) => s + v.stockQuantity, 0) : p.stockQuantity, hasVariants: p.variants.length > 0 }))
    .filter(p => p.stock <= config.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock);
  res.json(low);
});

// ---------- Dynamic pricing engine (sales-data based drafts) ----------
r.get('/pricing-suggestions', async (_q, res) => {
  const since = new Date(Date.now() - 30 * 864e5);
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    include: { orderItems: { where: { order: { createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } } } } },
  });
  const slow: unknown[] = [];
  const hot: unknown[] = [];
  for (const p of products) {
    const units = p.orderItems.reduce((s, i) => s + i.quantity, 0);
    const price = Number(p.price);
    if (units === 0 && p.createdAt < since && p.stockQuantity > 0) {
      const suggested = Math.max(99, Math.floor(price * 0.9));
      if (suggested < price) {
        slow.push({ productId: p.id, name: p.name, currentPrice: price, suggestedPrice: suggested, reason: `30 din se koi sale nahi — 10% discount suggest kiya hai (${suggested.toLocaleString()})` });
      }
    }
    if (units >= 10 && p.compareAtPrice && Number(p.compareAtPrice) > price) {
      hot.push({ productId: p.id, name: p.name, currentPrice: price, suggestedPrice: Number(p.compareAtPrice), reason: `${units} units 30 din me bik gaye — discount hata kar was-price restore karein` });
    }
  }
  res.json({ slow: slow.slice(0, 10), hot: hot.slice(0, 10) });
});

// Create a pricing APPROVAL draft (owner approves before it goes live)
r.post('/pricing-approval', async (req, res, next) => {
  try {
    const d = z.object({ productId: z.string(), newPrice: z.coerce.number().positive(), reason: z.string().max(300) }).parse(req.body);
    const product = await prisma.product.findUnique({ where: { id: d.productId }, select: { name: true, price: true } });
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    await createOpsNotification({
      kind: 'APPROVAL',
      category: 'PRICING',
      title: `Price change draft: ${product.name} — PKR ${Number(product.price).toLocaleString()} → PKR ${d.newPrice.toLocaleString()}`,
      body: d.reason,
      payload: { productId: d.productId, newPrice: d.newPrice },
    });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- Purchase orders (supplier drafts — human approved) ----------
r.get('/purchase-orders', async (_q, res) =>
  res.json(await prisma.purchaseOrder.findMany({
    include: { product: { select: { name: true, sku: true } } },
    orderBy: { createdAt: 'desc' },
  })),
);

r.post('/purchase-orders', async (req, res, next) => {
  try {
    const d = z.object({ productId: z.string(), variantId: z.string().optional(), qty: z.coerce.number().int().min(1), note: z.string().max(500).optional() }).parse(req.body);
    const po = await prisma.purchaseOrder.create({ data: { productId: d.productId, variantId: d.variantId ?? null, qty: d.qty, note: d.note } });
    await audit(req.auth!.id, 'CREATE', 'PurchaseOrder', po.id, { qty: d.qty });
    res.status(201).json(po);
  } catch (e) { next(e); }
});

r.patch('/purchase-orders/:id', async (req, res, next) => {
  try {
    const { action } = z.object({ action: z.enum(['order', 'receive', 'cancel']) }).parse(req.body);
    const po = await prisma.purchaseOrder.findUnique({ where: { id: String(req.params.id) } });
    if (!po) return res.status(404).json({ message: 'Purchase order not found.' });

    if (action === 'order') {
      const updated = await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'ORDERED', orderedAt: new Date() } });
      await audit(req.auth!.id, 'PO_ORDERED', 'PurchaseOrder', po.id, { qty: po.qty });
      return res.json(updated);
    }
    if (action === 'cancel') {
      const updated = await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'CANCELLED' } });
      await audit(req.auth!.id, 'PO_CANCELLED', 'PurchaseOrder', po.id);
      return res.json(updated);
    }
    // receive: stock arrives — increment inventory
    const data = po.variantId
      ? { variants: { update: { where: { id: po.variantId }, data: { stockQuantity: { increment: po.qty } } } } }
      : { stockQuantity: { increment: po.qty } };
    await prisma.product.update({ where: { id: po.productId }, data });
    const updated = await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'RECEIVED', receivedAt: new Date() } });
    await audit(req.auth!.id, 'PO_RECEIVED', 'PurchaseOrder', po.id, { qty: po.qty, variantId: po.variantId });
    res.json(updated);
  } catch (e) { next(e); }
});

// ---------- Summary counters ----------
r.get('/summary', async (_q, res) => {
  const [openApprovals, openAlerts, criticalAlerts, flaggedOrders, draftPOs] = await Promise.all([
    prisma.adminNotification.count({ where: { kind: 'APPROVAL', status: { in: ['NEW', 'READ'] } } }),
    prisma.adminNotification.count({ where: { kind: 'ALERT', status: { in: ['NEW', 'READ'] } } }),
    prisma.adminNotification.count({ where: { kind: 'ALERT', severity: 'CRITICAL', status: { in: ['NEW', 'READ'] } } }),
    prisma.order.count({ where: { needsVerification: true, status: { in: ['PENDING', 'CONFIRMED'] } } }),
    prisma.purchaseOrder.count({ where: { status: 'DRAFT' } }),
  ]);
  res.json({ openApprovals, openAlerts, criticalAlerts, flaggedOrders, draftPOs });
});

// ---------- Marketing drafts (WhatsApp broadcast text — owner sends manually) ----------
r.get('/marketing/whatsapp-broadcast', async (_q, res) => {
  const featured = await prisma.product.findMany({
    where: { status: 'ACTIVE', isFeatured: true },
    include: { images: { take: 1 } },
    take: 4,
    orderBy: { updatedAt: 'desc' },
  });
  const coupon = await prisma.coupon.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
  const lines = featured.map(p => `• ${p.name} — PKR ${Number(p.price).toLocaleString()}`).join('\n');
  const text = `*SELL WAVE — Naye deals!*\n\n${lines}\n\n${coupon ? `Coupon *${coupon.code}* — ${coupon.description ?? 'discount'}\n` : ''}COD + Bank transfer available\nPakistan-wide delivery\nOrder: https://sellwave.pk\nWhatsApp: 0311 9579613`;
  res.json({ text, products: featured.map(p => ({ name: p.name, price: p.price, image: p.images[0]?.url ?? null })) });
});

export default r;
