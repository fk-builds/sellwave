import { Router } from 'express';
import { prisma } from '../utils/prisma.js';

const r = Router();

// Public order tracking — limited, non-personal fields only.
r.get('/track/:orderNumber', async (req, res) => {
  const orderNumber = String(req.params.orderNumber).trim().toUpperCase();
  if (!/^SW-\d+-\d{3}$/.test(orderNumber)) return res.status(400).json({ message: 'Order number format: SW-xxxxxxxxx-000' });
  const o = await prisma.order.findFirst({
    where: { orderNumber },
    select: {
      orderNumber: true, status: true, paymentMethod: true, paymentStatus: true,
      createdAt: true, updatedAt: true, shippingAddress: true, items: { select: { quantity: true } },
    },
  });
  if (!o) return res.status(404).json({ message: 'Is number par koi order nahi mila. Number dobara check karein.' });
  const city = (o.shippingAddress as { city?: string } | null)?.city ?? null;
  const items = o.items.reduce((s, i) => s + i.quantity, 0);
  res.json({
    orderNumber: o.orderNumber, status: o.status, paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus, createdAt: o.createdAt, updatedAt: o.updatedAt, city, items,
  });
});

// Public delivery coverage — zones/cities/rates for the map page.
r.get('/coverage', async (_req, res) => {
  const zones = await prisma.shippingZone.findMany({
    where: { isActive: true },
    include: { rates: { where: { isActive: true }, orderBy: { minimumWeightGrams: 'asc' } } },
  });
  res.json(zones.map(z => ({
    name: z.name, cities: z.cities,
    rates: z.rates.map(rt => ({ name: rt.name, min: rt.minimumWeightGrams, max: rt.maximumWeightGrams, amount: rt.amount })),
  })));
});

export default r;
