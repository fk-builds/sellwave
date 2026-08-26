/**
 * DEV/DEMO ONLY — creates throwaway catalogue + test customer for sandbox previews.
 * NEVER run against a production database. Safe to re-run (idempotent upserts).
 */
import { PrismaClient, ProductStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // ---- store settings incl. bank details ----
  const current = await prisma.siteSetting.findUnique({ where: { key: 'store' } });
  const value = { ...(current?.value as Record<string, unknown> | null ?? {}) };
  value.bank = {
    accountTitle: 'Fawad Khan',
    bankName: 'UBL (United Bank Limited)',
    accountNumber: '0033338799838',
    iban: 'PK07UNIL0109000338799838',
    raastNumber: '',
    instructions: 'Raast / IBFT se exact order total transfer karein. Payment ke baad receipt screenshot WhatsApp 0311 9579613 par bhej dein. Order payment verify hone ke baad process hota hai.',
  };
  await prisma.siteSetting.upsert({ where: { key: 'store' }, update: { value: value as never }, create: { key: 'store', value: value as never } });

  // ---- categories ----
  const cat = async (name: string, slug: string, sortOrder: number) =>
    prisma.category.upsert({ where: { slug }, update: { name, sortOrder }, create: { name, slug, sortOrder, isActive: true } });
  const electronics = await cat('Electronics', 'electronics', 1);
  const fashion = await cat('Fashion & Bags', 'fashion', 3);
  const beauty = await cat('Beauty & Care', 'beauty', 4);
  const sports = await cat('Sports & Fitness', 'sports', 5);

  // ---- products ----
  const prod = async (d: { slug: string; name: string; sku: string; price: number; compareAtPrice?: number; stock: number; weight: number; short: string; cat: { id: string }; featured?: boolean; image: string; variants?: { name: string; sku: string; price?: number; stock: number }[] }) => {
    const p = await prisma.product.upsert({
      where: { slug: d.slug },
      update: { isFeatured: !!d.featured, status: ProductStatus.ACTIVE },
      create: {
        name: d.name, slug: d.slug, sku: d.sku, categoryId: d.cat.id, price: d.price,
        compareAtPrice: d.compareAtPrice, stockQuantity: d.stock, weightGrams: d.weight,
        shortDescription: d.short, isFeatured: !!d.featured, status: ProductStatus.ACTIVE,
      },
    });
    const has = await prisma.productImage.findFirst({ where: { productId: p.id, url: d.image } });
    if (!has) await prisma.productImage.create({ data: { productId: p.id, url: d.image, alt: d.name, sortOrder: 0 } });
    for (const [i, v] of (d.variants ?? []).entries()) {
      const exists = await prisma.productVariant.findFirst({ where: { productId: p.id, name: v.name } });
      if (!exists) await prisma.productVariant.create({ data: { productId: p.id, name: v.name, sku: v.sku, price: v.price, stockQuantity: v.stock, sortOrder: i } });
    }
    return p;
  };

  await prod({
    slug: 'wireless-earbuds-pro', name: 'Wireless Earbuds Pro', sku: 'SW-EBP-01', price: 4500, compareAtPrice: 5999,
    stock: 0, weight: 250, short: 'ANC wireless earbuds with charging case.', cat: electronics, featured: true,
    image: 'http://localhost:5173/products/earbuds.jpg',
    variants: [
      { name: 'Black', sku: 'SW-EBP-01-BLK', stock: 8 },
      { name: 'White', sku: 'SW-EBP-01-WHT', price: 4700, stock: 5 },
    ],
  });
  await prod({
    slug: 'classic-leather-handbag', name: 'Classic Leather Handbag', sku: 'SW-CLH-01', price: 3499, compareAtPrice: 4999,
    stock: 15, weight: 800, short: 'Premium leather handbag with gold clasp — everyday elegance.', cat: fashion, featured: true,
    image: 'http://localhost:5173/products/handbag.jpg',
  });
  await prod({
    slug: 'glow-vitamin-c-serum', name: 'Glow Vitamin C Serum', sku: 'SW-GVCS-01', price: 1999, compareAtPrice: 2599,
    stock: 40, weight: 120, short: 'Brightening vitamin C serum for radiant skin, 30ml.', cat: beauty, featured: true,
    image: 'http://localhost:5173/products/serum.jpg',
  });
  await prod({
    slug: 'yoga-mat-pro-6mm', name: 'Yoga Mat Pro 6mm', sku: 'SW-YMP-01', price: 1499, compareAtPrice: 1999,
    stock: 25, weight: 1000, short: 'Anti-slip 6mm yoga mat with carrying strap.', cat: sports,
    image: 'http://localhost:5173/products/yogamat.jpg',
  });

  // ---- coupon ----
  await prisma.coupon.upsert({
    where: { code: 'WAVE500' },
    update: {},
    create: { code: 'WAVE500', type: 'FIXED', value: 500, minimumOrderAmount: 3000, description: 'Rs 500 off above 3000' },
  });

  // ---- test customer ----
  const bcrypt = (await import('bcryptjs')).default;
  const cust = await prisma.user.upsert({
    where: { email: 'ali@test.pk' },
    update: {},
    create: {
      email: 'ali@test.pk',
      passwordHash: await bcrypt.hash('Password-123', 12),
      firstName: 'Ali', lastName: 'Raza', role: 'CUSTOMER',
    },
  });
  const addr = await prisma.address.findFirst({ where: { userId: cust.id } });
  if (!addr) {
    await prisma.address.create({
      data: { userId: cust.id, label: 'Home', recipientName: 'Ali Raza', phone: '03001234567', line1: 'House 12, Street 4', city: 'Rawalpindi', province: 'Punjab', isDefault: true },
    });
  }

  console.log('Demo data ready: 4 categories, 4 products, coupon WAVE500, customer ali@test.pk / Password-123');
}
main().finally(() => prisma.$disconnect());
