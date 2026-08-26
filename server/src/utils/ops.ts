import { prisma } from './prisma.js';
import { sendEmail } from './email.js';
import { env } from '../config/env.js';

export type AutomationConfig = {
  lowStockThreshold: number;
  codMaxOrderValue: number;
  fraudCancelledLimit: number;
  fraudMinAccountHours: number;
  fraudScoreThreshold: number;
  autoHighlightPositiveReviews: boolean;
};

export const DEFAULT_AUTOMATION: AutomationConfig = {
  lowStockThreshold: 5,
  codMaxOrderValue: 20000,
  fraudCancelledLimit: 2,
  fraudMinAccountHours: 24,
  fraudScoreThreshold: 20,
  autoHighlightPositiveReviews: true,
};

export async function automationConfig(): Promise<AutomationConfig> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: 'automation' } });
  const raw = (setting?.value ?? {}) as Partial<AutomationConfig>;
  const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : fallback);
  return {
    lowStockThreshold: num(raw.lowStockThreshold, DEFAULT_AUTOMATION.lowStockThreshold),
    codMaxOrderValue: num(raw.codMaxOrderValue, DEFAULT_AUTOMATION.codMaxOrderValue),
    fraudCancelledLimit: num(raw.fraudCancelledLimit, DEFAULT_AUTOMATION.fraudCancelledLimit),
    fraudMinAccountHours: num(raw.fraudMinAccountHours, DEFAULT_AUTOMATION.fraudMinAccountHours),
    fraudScoreThreshold: num(raw.fraudScoreThreshold, DEFAULT_AUTOMATION.fraudScoreThreshold),
    autoHighlightPositiveReviews: raw.autoHighlightPositiveReviews !== false,
  };
}

/** Create an admin notification (alert or approval). Deduplicates open alerts for restock/fraud categories. */
export async function createOpsNotification(input: {
  kind: 'ALERT' | 'APPROVAL';
  category: string;
  title: string;
  body: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  payload?: Record<string, unknown>;
  dedupeOpen?: boolean;
}): Promise<boolean> {
  if (input.dedupeOpen) {
    const existing = await prisma.adminNotification.findFirst({
      where: { category: input.category, status: { in: ['NEW', 'READ'] }, title: input.title },
    });
    if (existing) return false;
  }
  await prisma.adminNotification.create({
    data: {
      kind: input.kind,
      category: input.category,
      title: input.title,
      body: input.body,
      severity: input.severity ?? 'INFO',
      payload: (input.payload ?? {}) as never,
    },
  });
  return true;
}

export async function emailOwner(subject: string, html: string): Promise<void> {
  await sendEmail({ to: env.OWNER_EMAIL, subject, html });
}

/** Restock agent: alerts on low stock for active products (deduped). Returns count of new alerts. */
export async function runLowStockCheck(): Promise<number> {
  const config = await automationConfig();
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    include: { variants: { where: { isActive: true } } },
  });
  let created = 0;
  for (const p of products) {
    const total = p.variants.length > 0 ? p.variants.reduce((s, v) => s + v.stockQuantity, 0) : p.stockQuantity;
    if (total <= config.lowStockThreshold) {
      const ok = await createOpsNotification({
        kind: 'ALERT',
        category: 'RESTOCK',
        severity: total === 0 ? 'CRITICAL' : 'WARNING',
        title: `Low stock: ${p.name} (${total} left)`,
        body: `${p.name} ka stock ${total} reh gaya (threshold ${config.lowStockThreshold}). Re-order draft banayein ya stock update karein.`,
        payload: { productId: p.id, stock: total },
        dedupeOpen: true,
      });
      if (ok) created++;
    }
  }
  return created;
}

export type FraudAssessment = { score: number; flags: string[]; needsVerification: boolean };

/** Fraud & Order Risk Guard: rule-based score for a checkout attempt. */
export async function assessOrderRisk(input: {
  userId: string;
  accountCreatedAt: Date;
  paymentMethod: string;
  subtotal: number;
  maxLineQty: number;
}): Promise<FraudAssessment> {
  const config = await automationConfig();
  const flags: string[] = [];
  let score = 0;

  if (input.paymentMethod === 'COD' && input.subtotal >= config.codMaxOrderValue) {
    flags.push(`High-value COD order (PKR ${Math.round(input.subtotal).toLocaleString()} ≥ limit ${config.codMaxOrderValue.toLocaleString()})`);
    score += 25;
  }
  const badHistory = await prisma.order.count({
    where: { userId: input.userId, status: { in: ['CANCELLED', 'REFUNDED'] } },
  });
  if (badHistory >= config.fraudCancelledLimit) {
    flags.push(`Customer ki past ${badHistory} cancelled/refunded orders hain`);
    score += 25;
  }
  const accountHours = (Date.now() - input.accountCreatedAt.getTime()) / 36e5;
  if (accountHours < config.fraudMinAccountHours && input.paymentMethod === 'COD' && input.subtotal >= 5000) {
    flags.push(`Naya account (${Math.round(accountHours)}h purana) + high-value COD`);
    score += 20;
  }
  if (input.maxLineQty > 4) {
    flags.push(`Bulk quantity (ek item ke ${input.maxLineQty} units)`);
    score += 10;
  }

  return { score, flags, needsVerification: score >= config.fraudScoreThreshold };
}
