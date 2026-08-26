import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { estimateShipping } from '../utils/shippingCalc.js';

const r = Router();

const variantInclude = {
  variants: {
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }],
  },
};

r.get('/categories', async (_req, res) => {
  res.json(await prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }));
});

r.get('/products', async (req, res) => {
  const q = String(req.query.q || '');
  const category = String(req.query.category || '');
  const featured = String(req.query.featured || '') === '1';
  const products = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      ...(featured ? { isFeatured: true } : {}),
      ...(category ? { category: { slug: category } } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      category: true,
      ...variantInclude,
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  res.json(products);
});

// Delivery estimate: customer ke cart weight + selected city ke hisab se
r.get('/shipping/estimate', requireAuth, async (req, res) => {
  const userId = (req as unknown as { auth?: { id: string } }).auth?.id;
  if (!userId) return res.status(401).json({ message: 'Sign in required.' });
  const city = String(req.query.city || '');
  const items = await prisma.cartItem.findMany({ where: { userId }, include: { product: { select: { weightGrams: true } } } });
  const weight = items.reduce((s, i) => s + (i.product.weightGrams ?? 500) * i.quantity, 0);
  res.json({ weightGrams: weight, ...(await estimateShipping(city, weight)) });
});

r.get('/products/:slug', async (req, res) => {
  const p = await prisma.product.findUnique({
    where: { slug: String(req.params.slug) },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      category: true,
      ...variantInclude,
      reviews: {
        where: { isApproved: true },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!p) return res.status(404).json({ message: 'Product not found.' });
  res.json(p);
});

export default r;
