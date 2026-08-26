import { prisma } from './prisma.js';

export type ShippingEstimate = { amount: number | null; zone: string | null; rate: string | null };

/** City + total weight se matching active zone/rate dhoondta hai. Case-insensitive city match. */
export async function estimateShipping(city: string | null | undefined, weightGrams: number): Promise<ShippingEstimate> {
  if (!city || !city.trim()) return { amount: null, zone: null, rate: null };
  const zones = await prisma.shippingZone.findMany({
    where: { isActive: true },
    include: { rates: { where: { isActive: true }, orderBy: { minimumWeightGrams: 'asc' } } },
  });
  const c = city.trim().toLowerCase();
  const zone = zones.find(z => z.cities.some(x => x.trim().toLowerCase() === c));
  if (!zone || zone.rates.length === 0) return { amount: null, zone: zone?.name ?? null, rate: null };
  const rate =
    zone.rates.find(r => weightGrams >= r.minimumWeightGrams && (r.maximumWeightGrams === null || weightGrams <= r.maximumWeightGrams)) ??
    null;
  if (!rate) return { amount: null, zone: zone.name, rate: null };
  return { amount: Number(rate.amount), zone: zone.name, rate: rate.name };
}
