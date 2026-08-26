import { Router } from 'express';
import { prisma } from '../utils/prisma.js';

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

export default r;
