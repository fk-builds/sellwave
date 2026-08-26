import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
r.use(requireAuth);

const include = {
  product: { include: { images: { orderBy: { sortOrder: 'asc' as const }, take: 1 }, category: true } },
  variant: true,
};

// Price used for a cart line: variant price overrides the product price when set.
export const linePrice = (product: { price: unknown }, variant?: { price: unknown } | null): number =>
  Number(variant && variant.price !== null ? variant.price : product.price);

const cartOf = (userId: string) =>
  prisma.cartItem.findMany({ where: { userId }, include, orderBy: { id: 'desc' } });

r.get('/', async (req, res) => res.json(await cartOf(req.auth!.id)));

r.post('/', async (req, res, next) => {
  try {
    const d = z.object({
      productId: z.string(),
      variantId: z.string().optional(),
      quantity: z.coerce.number().int().min(1).max(99),
    }).parse(req.body);

    const product = await prisma.product.findFirst({
      where: { id: d.productId, status: 'ACTIVE' },
      include: { variants: { where: { isActive: true } } },
    });
    if (!product) return res.status(404).json({ message: 'This product is not available.' });

    let variant: { id: string; stockQuantity: number } | null = null;
    if (product.variants.length > 0) {
      if (!d.variantId) return res.status(400).json({ message: 'Please choose an option (size/colour) first.' });
      variant = product.variants.find(v => v.id === d.variantId) ?? null;
      if (!variant) return res.status(400).json({ message: 'Please choose a valid option.' });
      if (variant.stockQuantity < d.quantity) return res.status(400).json({ message: 'Requested quantity is not in stock.' });
    } else {
      if (d.variantId) return res.status(400).json({ message: 'This product has no options.' });
      if (product.stockQuantity < d.quantity) return res.status(400).json({ message: 'Requested quantity is not in stock.' });
    }

    const existing = await prisma.cartItem.findFirst({
      where: { userId: req.auth!.id, productId: d.productId, variantId: d.variantId ?? null },
    });
    const item = existing
      ? await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: d.quantity } })
      : await prisma.cartItem.create({
          data: { userId: req.auth!.id, productId: d.productId, variantId: d.variantId ?? null, quantity: d.quantity },
        });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const d = z.object({ quantity: z.coerce.number().int().min(1).max(99) }).parse(req.body);
    const item = await prisma.cartItem.findFirst({
      where: { id: String(req.params.id), userId: req.auth!.id },
      include: { product: true, variant: true },
    });
    if (!item) return res.status(404).json({ message: 'Cart item not found.' });
    const available = item.variant ? item.variant.stockQuantity : item.product.stockQuantity;
    if (d.quantity > available) return res.status(400).json({ message: 'Requested quantity is not in stock.' });
    res.json(await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: d.quantity } }));
  } catch (e) { next(e); }
});

r.delete('/:id', async (req, res) => {
  const item = await prisma.cartItem.findFirst({ where: { id: String(req.params.id), userId: req.auth!.id } });
  if (!item) return res.status(404).json({ message: 'Cart item not found.' });
  await prisma.cartItem.delete({ where: { id: item.id } });
  res.status(204).send();
});

export default r;
