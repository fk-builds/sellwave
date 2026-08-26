import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();

const signup = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
});

const setCookie = (res: import('express').Response, id: string, role: string) =>
  res.cookie('access_token', jwt.sign({ id, role }, env.JWT_SECRET, { expiresIn: '7d' }), {
    httpOnly: true,
    secure: env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: 604800000,
  });

r.post('/register', async (req, res, next) => {
  try {
    const d = signup.parse(req.body);
    const email = d.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      return res.status(409).json({ message: 'An account already exists with this email.' });
    }
    const { password, ...rest } = d;
    const u = await prisma.user.create({ data: { ...rest, email, passwordHash: await bcrypt.hash(password, 12) } });
    setCookie(res, u.id, u.role);
    res.status(201).json({ user: { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role } });
  } catch (e) { next(e); }
});

r.post('/login', async (req, res, next) => {
  try {
    const d = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const u = await prisma.user.findUnique({ where: { email: d.email.toLowerCase() } });
    if (!u || !u.isActive || !(await bcrypt.compare(d.password, u.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    setCookie(res, u.id, u.role);
    res.json({ user: { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role } });
  } catch (e) { next(e); }
});

r.post('/logout', (_req, res) => { res.clearCookie('access_token'); res.status(204).send(); });

r.get('/me', requireAuth, async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.auth!.id },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, loyaltyPoints: true, createdAt: true },
  });
  res.json({ user: u });
});

export default r;
