import { PrismaClient, Role, ProductStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.includes('Change-this')) throw new Error('Set a unique ADMIN_EMAIL and ADMIN_PASSWORD in .env before seeding.');
  await prisma.user.upsert({
    where: { email },
    update: { role: Role.ADMIN },
    create: { email, passwordHash: await bcrypt.hash(password, 12), firstName: 'Sell', lastName: 'Wave', role: Role.ADMIN },
  });

  const store = {
    name: 'Sell Wave',
    country: 'Pakistan',
    currency: 'PKR',
    supportEmail: 'sellwave04@gmail.com',
    supportWhatsapp: '03119579613',
    deliveryCoverage: 'Pakistan-wide',
    deliveryPricing: 'Calculated by delivery location and product weight',
    returnWindowDays: 7,
    returnPolicy: 'Eligible for courier damage, broken items or other approved faults. Customer-caused damage is not eligible.',
    codVerification: 'ADMIN_CHOICE',
    loyalty: { name: 'Wave Points', earnRatePkr: 100, redeemValuePkr: 1, maxRedeemShare: 0.5 },
    bank: { accountTitle: '', bankName: '', accountNumber: '', iban: '', raastNumber: '', instructions: 'Transfer the exact order total, then send the receipt screenshot on WhatsApp 0311 9579613.' },
  };
  // Non-destructive: an existing setting (edited from the admin panel) is never overwritten by re-seeding.
  await prisma.siteSetting.upsert({ where: { key: 'store' }, update: {}, create: { key: 'store', value: store } });

  const headlines = {
    key: 'headlines',
    value: [
      'Pakistan-wide delivery · COD available · Support: 0311 9579613',
      '7-day easy returns — damaged ya faulty item? Bina jhanjhat return karein',
      'Wave Points: har delivered order par points, checkout par discount',
    ],
  };
  await prisma.siteSetting.upsert({ where: { key: 'headlines' }, update: {}, create: headlines });

  const slides = {
    key: 'homepage_slides',
    value: [
      { image: '/banners/electronics-hero.jpg', eyebrow: 'SELL WAVE · PAKISTAN', title1: 'The future of your', title2: 'everyday living.', copy: 'Discover essentials across technology, home, fashion and more — delivered across Pakistan.', cta: 'Explore the store', link: '/shop', active: true },
      { image: '/banners/gadgets.jpg', eyebrow: 'TECH & GADGETS', title1: 'Smart picks for', title2: 'smart living.', copy: 'Watches, audio and everyday tech — curated and fulfilled directly by Sell Wave.', cta: 'Shop gadgets', link: '/shop', active: true },
      { image: '/banners/fashion.jpg', eyebrow: 'CURATED FOR EVERYDAY', title1: 'Find more to love.', title2: 'For less.', copy: 'Fresh finds, thoughtful choices and a simpler way to shop from one trusted store.', cta: 'Shop new arrivals', link: '/shop', active: true },
      { image: '/banners/deals.jpg', eyebrow: 'BEST DEALS', title1: 'Big value.', title2: 'One store.', copy: 'Hand-picked deals across every aisle — with honest pricing and no surprises.', cta: 'See all deals', link: '/shop', active: true },
      { image: '/banners/sports.jpg', eyebrow: 'SPORTS & FITNESS', title1: 'Move more.', title2: 'Worry less.', copy: 'Gear up with fitness and outdoor essentials built to keep up with you.', cta: 'Shop sports', link: '/shop', active: true },
      { image: '/banners/appliances.jpg', eyebrow: 'HOME APPLIANCES', title1: 'Upgrade every', title2: 'corner of home.', copy: 'Reliable appliances for kitchens and living spaces, delivered nationwide.', cta: 'Shop appliances', link: '/shop', active: true },
      { image: '/banners/home-garden.jpg', eyebrow: 'HOME & GARDEN', title1: 'Make space', title2: 'for living.', copy: 'Everything for your home, garden and balcony — thoughtfully sourced.', cta: 'Shop home', link: '/shop', active: true },
      { image: '/banners/beauty.jpg', eyebrow: 'BEAUTY & CARE', title1: 'Glow up your', title2: 'daily routine.', copy: 'Skincare, fragrance and beauty picks for every day and every occasion.', cta: 'Shop beauty', link: '/shop', active: true },
    ],
  };
  await prisma.siteSetting.upsert({ where: { key: 'homepage_slides' }, update: {}, create: slides });

  // Temporary catalogue entries are only created when explicitly enabled. They are easy to delete from admin.
  if (process.env.SEED_TEMPORARY_CATALOG === 'true') {
    const category = await prisma.category.upsert({ where: { slug: 'new-arrivals' }, update: {}, create: { name: 'New Arrivals', slug: 'new-arrivals', description: 'Temporary catalogue category', isActive: true } });
    for (const p of [
      { name: 'Temporary Product One', slug: 'temporary-product-one', sku: 'TEMP-001', price: 1999 },
      { name: 'Temporary Product Two', slug: 'temporary-product-two', sku: 'TEMP-002', price: 2499 },
      { name: 'Temporary Product Three', slug: 'temporary-product-three', sku: 'TEMP-003', price: 2999 },
    ]) await prisma.product.upsert({ where: { slug: p.slug }, update: {}, create: { ...p, categoryId: category.id, stockQuantity: 10, status: ProductStatus.DRAFT, shortDescription: 'Temporary listing — replace with real product information before publishing.' } });
  }

  console.log(`Admin account is ready for ${email}. Temporary products are created only with SEED_TEMPORARY_CATALOG=true and remain drafts.`);
}
main().finally(() => prisma.$disconnect());
