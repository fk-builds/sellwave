import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const r = Router();
const request = z.object({ orderId: z.string(), reason: z.string().min(4).max(120), details: z.string().max(1000).optional() });

r.post('/', requireAuth, async (req, res, next) => {
  try {
    const d = request.parse(req.body);
    const order = await prisma.order.findFirst({ where: { id: d.orderId, userId: req.auth!.id } });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    const days = (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (days > 7) return res.status(400).json({ message: 'Return requests are accepted within 7 days of delivery/order date.' });
    const duplicate = await prisma.returnRequest.findFirst({ where: { orderId: d.orderId, userId: req.auth!.id, status: { in: ['REQUESTED', 'APPROVED', 'RECEIVED'] } } });
    if (duplicate) return res.status(409).json({ message: 'A return request for this order is already in progress.' });
    res.status(201).json(await prisma.returnRequest.create({ data: { ...d, userId: req.auth!.id } }));
  } catch (e) { next(e); }
});

r.get('/mine', requireAuth, async (req, res) =>
  res.json(await prisma.returnRequest.findMany({ where: { userId: req.auth!.id }, include: { order: { select: { orderNumber: true } } }, orderBy: { createdAt: 'desc' } })),
);

r.get('/admin', requireAuth, requireRole('ADMIN', 'STAFF'), async (_req, res) =>
  res.json(await prisma.returnRequest.findMany({
    include: { order: { select: { orderNumber: true, paymentMethod: true, totalAmount: true } }, user: { select: { email: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  })),
);

r.patch('/admin/:id', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const d = z.object({
      status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED']),
      adminNote: z.string().max(1000).optional(),
    }).parse(req.body);
    res.json(await prisma.returnRequest.update({ where: { id: String(req.params.id) }, data: d }));
  } catch (e) { next(e); }
});

export default r;
