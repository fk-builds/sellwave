import { Router } from 'express';
import { prisma } from '../utils/prisma.js';

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
