import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
r.use(requireAuth);

const address = z.object({
  label: z.string().min(1).max(30),
  recipientName: z.string().min(2),
  phone: z.string().min(7).max(20),
  line1: z.string().min(3),
  line2: z.string().max(100).optional(),
  city: z.string().min(2),
  province: z.string().max(50).optional(),
  postalCode: z.string().max(20).optional(),
  isDefault: z.boolean().optional(),
});

r.get('/addresses', async (req, res) => res.json(await prisma.address.findMany({ where: { userId: req.auth!.id }, orderBy: { isDefault: 'desc' } })));

r.post('/addresses', async (req, res, next) => {
  try {
    const d = address.parse(req.body);
    const count = await prisma.address.count({ where: { userId: req.auth!.id } });
    if (d.isDefault || count === 0) await prisma.address.updateMany({ where: { userId: req.auth!.id }, data: { isDefault: false } });
    res.status(201).json(await prisma.address.create({ data: { ...d, isDefault: d.isDefault || count === 0, userId: req.auth!.id } }));
  } catch (e) { next(e); }
});

// Loyalty (Wave Points) balance + recent ledger for the signed-in customer.
r.get('/loyalty', async (req, res) => {
  const [user, transactions] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.auth!.id }, select: { loyaltyPoints: true } }),
    prisma.loyaltyTransaction.findMany({ where: { userId: req.auth!.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  res.json({ points: user?.loyaltyPoints ?? 0, transactions });
});

// Profile update (name + phone).
r.patch('/profile', async (req, res, next) => {
  try {
    const d = z.object({
      firstName: z.string().min(1).max(50),
      lastName: z.string().min(1).max(50),
      phone: z.string().min(7).max(20).optional(),
      city: z.string().max(60).optional(),
    }).parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.auth!.id },
      data: d,
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, city: true, role: true },
    });
    res.json({ user });
  } catch (e) { next(e); }
});

// Change password (requires current password).
r.post('/password', async (req, res, next) => {
  try {
    const d = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(128) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.auth!.id } });
    if (!user || !(await bcrypt.compare(d.currentPassword, user.passwordHash))) {
      return res.status(400).json({ message: 'Current password is not correct.' });
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(d.newPassword, 12) } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
