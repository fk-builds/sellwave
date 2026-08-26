import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const r = Router();
r.use(requireAuth, requireRole('ADMIN', 'STAFF'));

const zone = z.object({ name: z.string().min(2), cities: z.array(z.string().min(2)).min(1), isActive: z.boolean().optional() });
const rate = z.object({
  zoneId: z.string(),
  name: z.string().min(2),
  minimumWeightGrams: z.coerce.number().int().min(0),
  maximumWeightGrams: z.coerce.number().int().positive().optional(),
  amount: z.coerce.number().nonnegative(),
  isActive: z.boolean().optional(),
});

r.get('/zones', async (_q, res) => res.json(await prisma.shippingZone.findMany({ orderBy: { name: 'asc' }, include: { rates: true } })));
r.post('/zones', async (req, res, next) => {
  try { res.status(201).json(await prisma.shippingZone.create({ data: zone.parse(req.body) })); } catch (e) { next(e); }
});
r.patch('/zones/:id', async (req, res, next) => {
  try { res.json(await prisma.shippingZone.update({ where: { id: String(req.params.id) }, data: zone.partial().parse(req.body) })); } catch (e) { next(e); }
});
r.get('/rates', async (_q, res) => res.json(await prisma.shippingRate.findMany({ orderBy: [{ zoneId: 'asc' }, { minimumWeightGrams: 'asc' }], include: { zone: { select: { name: true } } } })));
r.post('/rates', async (req, res, next) => {
  try { res.status(201).json(await prisma.shippingRate.create({ data: rate.parse(req.body) as never })); } catch (e) { next(e); }
});
r.patch('/rates/:id', async (req, res, next) => {
  try { res.json(await prisma.shippingRate.update({ where: { id: String(req.params.id) }, data: rate.partial().parse(req.body) })); } catch (e) { next(e); }
});

export default r;
