import { prisma } from './prisma.js';

export type LoyaltyConfig = {
  /** Spend this many PKR on a delivered order to earn 1 point. */
  earnRatePkr: number;
  /** PKR value of 1 point when redeemed at checkout. */
  redeemValuePkr: number;
  /** Redemption may cover at most this share of the order subtotal (0-1). */
  maxRedeemShare: number;
};

export const DEFAULT_LOYALTY: LoyaltyConfig = {
  earnRatePkr: 100,
  redeemValuePkr: 1,
  maxRedeemShare: 0.5,
};

/** Reads loyalty rules from the SiteSetting key `store` (JSON `loyalty` block), with safe defaults. */
export async function loyaltyConfig(): Promise<LoyaltyConfig> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: 'store' } });
  const raw = (setting?.value as { loyalty?: Partial<LoyaltyConfig> } | null)?.loyalty ?? {};
  const earnRatePkr = Number(raw.earnRatePkr);
  const redeemValuePkr = Number(raw.redeemValuePkr);
  const maxRedeemShare = Number(raw.maxRedeemShare);
  return {
    earnRatePkr: Number.isFinite(earnRatePkr) && earnRatePkr > 0 ? earnRatePkr : DEFAULT_LOYALTY.earnRatePkr,
    redeemValuePkr: Number.isFinite(redeemValuePkr) && redeemValuePkr > 0 ? redeemValuePkr : DEFAULT_LOYALTY.redeemValuePkr,
    maxRedeemShare:
      Number.isFinite(maxRedeemShare) && maxRedeemShare > 0 && maxRedeemShare <= 1 ? maxRedeemShare : DEFAULT_LOYALTY.maxRedeemShare,
  };
}
