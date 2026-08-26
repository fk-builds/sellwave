import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createOpsNotification } from '../utils/ops.js';

const r = Router();
r.use(requireAuth, requireRole('ADMIN', 'STAFF'));

const audit = (actorId: string, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) =>
  prisma.auditLog.create({ data: { actorId, action, entity, entityId, metadata: metadata as never } });

// ---------- Pricing agent settings ----------
const DEFAULTS = {
  highMarginFlat: 500,        // PKR profit on cost >= 1000 items
  lowMarginPercentTarget: 30, // 20-35% band for low-value items (target)
  deliveryCostPkr: 250,       // added to high-value base price
  marketCapPercent: 15,       // if our price exceeds market by this %, cap at market
  minProfitAlert: 500,        // below this profit after cap -> Low Margin Alert
};

type PricingConfig = typeof DEFAULTS;

async function config(): Promise<PricingConfig> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: 'pricing_agent' } });
  const raw = (setting?.value ?? {}) as Partial<PricingConfig>;
  const num = (v: unknown, f: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : f;
  };
  return {
    highMarginFlat: num(raw.highMarginFlat, DEFAULTS.highMarginFlat, 0, 100000),
    lowMarginPercentTarget: num(raw.lowMarginPercentTarget, DEFAULTS.lowMarginPercentTarget, 15, 40),
    deliveryCostPkr: num(raw.deliveryCostPkr, DEFAULTS.deliveryCostPkr, 0, 10000),
    marketCapPercent: num(raw.marketCapPercent, DEFAULTS.marketCapPercent, 5, 50),
    minProfitAlert: num(raw.minProfitAlert, DEFAULTS.minProfitAlert, 0, 100000),
  };
}

r.get('/settings', async (_q, res) => res.json(await config()));

r.put('/settings', async (req, res, next) => {
  try {
    const d = z.object({
      highMarginFlat: z.coerce.number().min(0).max(100000),
      lowMarginPercentTarget: z.coerce.number().min(15).max(40),
      deliveryCostPkr: z.coerce.number().min(0).max(10000),
      marketCapPercent: z.coerce.number().min(5).max(50),
      minProfitAlert: z.coerce.number().min(0).max(100000),
    }).parse(req.body);
    const current = await prisma.siteSetting.findUnique({ where: { key: 'pricing_agent' } });
    const value = { ...(current?.value as Record<string, unknown> | null ?? {}), ...d };
    await prisma.siteSetting.upsert({ where: { key: 'pricing_agent' }, update: { value: value as never }, create: { key: 'pricing_agent', value: value as never } });
    await audit(req.auth!.id, 'UPDATE', 'PricingAgentSettings', 'pricing_agent', d);
    res.json(d);
  } catch (e) { next(e); }
});

// ---------- Core calculation ----------
function calculate(cost: number, market: number, cfg: PricingConfig) {
  const highValue = cost >= 1000;
  const delivery = highValue ? cfg.deliveryCostPkr : 0;
  let price = highValue
    ? Math.round(cost + cfg.highMarginFlat + delivery)
    : Math.round(cost * (1 + cfg.lowMarginPercentTarget / 100));
  let profit = price - cost - delivery;
  let capped = false;
  let lowMargin = false;

  if (market > 0 && price > market * (1 + cfg.marketCapPercent / 100)) {
    price = Math.max(99, Math.round(market));
    profit = price - cost - delivery;
    capped = true;
    lowMargin = profit < cfg.minProfitAlert;
  }
  const anchor = market > 0 && market > price ? Math.round(market) : null;
  return { price, profit, capped, lowMargin, highValue, delivery, anchor };
}

const nice = (n: number) => Math.max(99, Math.round(n));

// ---------- Live breakdown ----------
r.post('/calculate', async (req, res, next) => {
  try {
    const d = z.object({
      productId: z.string(),
      costPrice: z.coerce.number().positive().optional(),
      marketPrice: z.coerce.number().nonnegative().optional(),
    }).parse(req.body);
    const product = await prisma.product.findUnique({ where: { id: d.productId } });
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    const cfg = await config();
    const cost = d.costPrice ?? Number(product.costPrice ?? 0);
    const market = d.marketPrice ?? Number(product.marketPrice ?? 0);
    if (cost <= 0) return res.status(400).json({ message: 'Pehle cost price set karein.' });
    const result = calculate(cost, market, cfg);
    res.json({ productId: product.id, name: product.name, currentPrice: Number(product.price), cost, market, ...result });
  } catch (e) { next(e); }
});

// ---------- Bulk cost/market price entry ----------
r.patch('/product-cost', async (req, res, next) => {
  try {
    const d = z.object({
      productId: z.string(),
      costPrice: z.coerce.number().positive().nullable(),
      marketPrice: z.coerce.number().nonnegative().nullable(),
    }).parse(req.body);
    const updated = await prisma.product.update({
      where: { id: d.productId },
      data: { costPrice: d.costPrice, marketPrice: d.marketPrice === 0 ? null : d.marketPrice },
    });
    await audit(req.auth!.id, 'UPDATE_COST', 'Product', d.productId, { costPrice: d.costPrice, marketPrice: d.marketPrice });
    res.json({ id: updated.id, costPrice: updated.costPrice, marketPrice: updated.marketPrice });
  } catch (e) { next(e); }
});

// ---------- Master scan: create approval drafts for every priced product ----------
r.post('/run', async (req, res, next) => {
  try {
    const cfg = await config();
    const products = await prisma.product.findMany({ where: { status: { not: 'ARCHIVED' }, costPrice: { not: null } } });
    let created = 0, lowMargin = 0, unchanged = 0;
    for (const p of products) {
      const cost = Number(p.costPrice ?? 0);
      const market = Number(p.marketPrice ?? 0);
      if (cost <= 0) continue;
      const plan = calculate(cost, market, cfg);
      if (plan.price === Number(p.price)) { unchanged++; continue; }

      const open = await prisma.adminNotification.findFirst({
        where: { category: { in: ['PRICING', 'LOW_MARGIN'] }, status: { in: ['NEW', 'READ'] }, title: { contains: p.name } },
      });
      if (open) continue;

      const breakdown = plan.highValue
        ? `Cost ${cost.toLocaleString()} + flat profit ${cfg.highMarginFlat} + delivery ${plan.delivery}${plan.capped ? ` → market cap: PKR ${plan.price.toLocaleString()} (${cfg.marketCapPercent}%+ above market nahi lungay)` : ''}`
        : `Cost ${cost.toLocaleString()} + ${cfg.lowMarginPercentTarget}% margin${plan.capped ? ` → market cap: PKR ${plan.price.toLocaleString()}` : ''}`;
      const profitLine = `Projected profit: PKR ${plan.profit.toLocaleString()} per unit${plan.lowMargin ? ' — RED FLAG: profit minimum se kam hai!' : ''}`;

      await createOpsNotification({
        kind: 'APPROVAL',
        category: plan.lowMargin ? 'LOW_MARGIN' : 'PRICING',
        severity: plan.lowMargin ? 'WARNING' : 'INFO',
        title: `${plan.lowMargin ? 'Low Margin Alert' : 'Price plan'}: ${p.name} — PKR ${Number(p.price).toLocaleString()} → PKR ${plan.price.toLocaleString()}`,
        body: `${breakdown}. ${profitLine} Approve karne par live ho jayega${plan.anchor ? `, anchor price (crossed-out): PKR ${plan.anchor.toLocaleString()}` : ''}.`,
        payload: { productId: p.id, newPrice: plan.price, compareAtPrice: plan.anchor ?? undefined, lowMargin: plan.lowMargin, profit: plan.profit },
        dedupeOpen: true,
      });
      created++;
      if (plan.lowMargin) lowMargin++;
    }
    await audit(req.auth!.id, 'RUN', 'PricingAgentScan', 'run', { created, lowMargin, unchanged });
    res.json({ ok: true, draftsCreated: created, lowMarginAlerts: lowMargin, alreadyAtTarget: unchanged });
  } catch (e) { next(e); }
});

// ---------- Live suggestions view ----------
r.get('/plans', async (_q, res) => {
  const cfg = await config();
  const products = await prisma.product.findMany({ where: { status: { not: 'ARCHIVED' }, costPrice: { not: null } }, include: { variants: { where: { isActive: true } } } });
  const plans = products.map(p => {
    const cost = Number(p.costPrice ?? 0);
    const market = Number(p.marketPrice ?? 0);
    const plan = cost > 0 ? calculate(cost, market, cfg) : null;
    const stock = p.variants.length > 0 ? p.variants.reduce((s, v) => s + v.stockQuantity, 0) : p.stockQuantity;
    return {
      id: p.id, name: p.name, sku: p.sku, currentPrice: Number(p.price), cost, market,
      stock, suggestedPrice: plan?.price ?? null, profit: plan?.profit ?? null,
      capped: plan?.capped ?? false, lowMargin: plan?.lowMargin ?? false, highValue: plan?.highValue ?? false,
      anchor: plan?.anchor ?? null, needsChange: plan ? plan.price !== Number(p.price) : false,
    };
  });
  res.json(plans.sort((a, b) => (a.cost > 0 ? 0 : 1) - (b.cost > 0 ? 0 : 1)));
});

// ---------- Smart bundle generator (low-value items) ----------
r.post('/bundle-suggestions', async (req, res, next) => {
  try {
    const cfg = await config();
    const items = await prisma.product.findMany({
      where: { status: 'ACTIVE', costPrice: { not: null, lt: 1000 }, stockQuantity: { gt: 0 } },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    if (items.length < 2) return res.json({ ok: true, created: 0, message: 'Bundles ke liye kam az kam 2 low-value (cost < 1000) products chahiye.' });

    const combos: { a: typeof items[0]; b: typeof items[0]; c?: typeof items[0] }[] = [];
    for (let i = 0; i < items.length && combos.length < 6; i++) {
      for (let j = i + 1; j < items.length && combos.length < 6; j++) combos.push({ a: items[i], b: items[j] });
    }

    let created = 0;
    for (const c of combos) {
      const name = `${c.a.name} + ${c.b.name} Combo`;
      const open = await prisma.adminNotification.findFirst({
        where: { category: 'BUNDLE', status: { in: ['NEW', 'READ'] }, title: { contains: c.a.name } },
      });
      if (open) continue;
      const totalCost = Number(c.a.costPrice ?? 0) + Number(c.b.costPrice ?? 0);
      const price = nice(totalCost * (1 + cfg.lowMarginPercentTarget / 100));
      const profit = price - totalCost;
      const anchorCandidates = [c.a, c.b].map(x => Number(x.marketPrice ?? 0)).filter(n => n > 0);
      const anchorTotal = anchorCandidates.length === 2 ? anchorCandidates[0] + anchorCandidates[1] : 0;
      await createOpsNotification({
        kind: 'APPROVAL',
        category: 'BUNDLE',
        title: `Smart Bundle draft: ${name} — PKR ${price.toLocaleString()}`,
        body: `Combined cost ${totalCost.toLocaleString()} + ${cfg.lowMarginPercentTarget}% margin → PKR ${price.toLocaleString()} (profit PKR ${profit.toLocaleString()}).${anchorTotal > price ? ` Anchor: PKR ${anchorTotal.toLocaleString()}.` : ''} Approve par bundle product ban kar live ho jayega.`,
        severity: profit < cfg.minProfitAlert ? 'WARNING' : 'INFO',
        payload: {
          bundle: {
            name, price, costPrice: totalCost,
            compareAtPrice: anchorTotal > price ? anchorTotal : undefined,
            componentIds: [c.a.id, c.b.id],
          },
        },
        dedupeOpen: true,
      });
      created++;
    }
    await audit(req.auth!.id, 'RUN', 'BundleSuggestions', 'run', { created });
    res.json({ ok: true, created });
  } catch (e) { next(e); }
});

export default r;
