import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { createOpsNotification } from '../utils/ops.js';

const r = Router();

// Public store settings — safe subset shown to customers (bank transfer details, support info).
r.get('/store', async (_req, res) => {
  const [setting, headlinesSetting, slidesSetting] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: 'store' } }),
    prisma.siteSetting.findUnique({ where: { key: 'headlines' } }),
    prisma.siteSetting.findUnique({ where: { key: 'homepage_slides' } }),
  ]);
  const value = (setting?.value ?? {}) as Record<string, unknown>;
  res.json({
    name: value.name ?? 'Sell Wave',
    supportEmail: value.supportEmail ?? null,
    supportWhatsapp: value.supportWhatsapp ?? null,
    returnPolicy: value.returnPolicy ?? null,
    loyalty: value.loyalty ?? null,
    bank: value.bank ?? null,
    headlines: Array.isArray(value.headlines) && value.headlines.length
      ? value.headlines
      : (Array.isArray(headlinesSetting?.value) ? headlinesSetting.value : []),
    slides: Array.isArray(value.slides) && value.slides.length
      ? value.slides
      : (Array.isArray(slidesSetting?.value) ? slidesSetting.value : []),
  });
});

// Newsletter subscribe (public) — email store + owner notification
r.post('/newsletter', async (req, res) => {
  const raw = String((req.body as { email?: string })?.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw) || raw.length > 120) {
    return res.status(400).json({ message: 'Valid email enter karein.' });
  }
  const key = 'newsletter_subscribers';
  const s = await prisma.siteSetting.findUnique({ where: { key } });
  const list = Array.isArray(s?.value) ? (s.value as string[]) : [];
  if (!list.includes(raw)) {
    list.push(raw);
    await prisma.siteSetting.upsert({ where: { key }, update: { value: list }, create: { key, value: list } });
    await createOpsNotification({
      kind: 'ALERT', category: 'NEWSLETTER', title: `New newsletter subscriber: ${raw}`,
      body: 'Marketing list me add ho gaya — campaigns me use karein.',
      payload: { email: raw },
    });
  }
  res.json({ ok: true });
});

export default r;
