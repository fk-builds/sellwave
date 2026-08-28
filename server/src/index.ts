import express from 'express'; import helmet from 'helmet'; import cors from 'cors'; import cookieParser from 'cookie-parser'; import { env } from './config/env.js'; import auth from './routes/auth.js'; import authReal from './routes/auth-real.js'; import catalog from './routes/catalog.js'; import admin from './routes/admin.js'; import cart from './routes/cart.js'; import account from './routes/account.js'; import wishlist from './routes/wishlist.js'; import returns from './routes/returns.js'; import shipping from './routes/shipping.js'; import reviews from './routes/reviews.js'; import orders from './routes/orders.js'; import settings from './routes/settings.js'; import opsAdmin from './routes/ops-admin.js'; import pricingAgent from './routes/pricing-agent.js'; import upload from './routes/upload.js'; import track from './routes/track.js'; import { errorHandler } from './middleware/errors.js'; import { prisma } from './utils/prisma.js';
const app=express(); app.set('trust proxy',1);app.use(helmet());app.use(cors({origin:env.CLIENT_ORIGIN,credentials:true}));app.use(express.json({limit:'1mb'}));app.use(cookieParser());app.get('/api/health',(_q,res)=>res.json({status:'ok'}));
app.get('/robots.txt', (_q, res) => {
  const base = (env.API_BASE_URL || 'https://sellwave-roan.vercel.app').replace(/\/$/, '');
  res.set('Content-Type', 'text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /checkout\n\nSitemap: ${base}/api/sitemap.xml`);
});
app.get('/api/sitemap.xml', async (_q, res) => {
  const base = (env.API_BASE_URL || 'https://sellwave-roan.vercel.app').replace(/\/$/, '');
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: { status: 'ACTIVE' }, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
  ]);
  const staticRoutes = ['/', '/shop', '/about', '/support', '/returns', '/terms', '/track'];
  const today = new Date().toISOString();
  const urls = [
    ...staticRoutes.map(u => ({ loc: `${base}${u}`, lastmod: today, priority: u === '/' ? '1.0' : '0.8' })),
    ...categories.map(c => ({ loc: `${base}/shop?category=${c.slug}`, lastmod: c.updatedAt.toISOString(), priority: '0.7' })),
    ...products.map(p => ({ loc: `${base}/product/${p.slug}`, lastmod: p.updatedAt.toISOString(), priority: '0.9' })),
  ];
  res.set('Content-Type', 'application/xml');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`);
});app.use('/api/auth',auth);app.use('/api/auth',authReal);app.use('/api',catalog);app.use('/api/admin/ops',opsAdmin);app.use('/api/admin/upload',upload);app.use('/api',track);app.use('/api/admin/pricing-agent',pricingAgent);app.use('/api/admin',admin);app.use('/api/cart',cart);app.use('/api/account',account);app.use('/api/wishlist',wishlist);app.use('/api/returns',returns);app.use('/api/admin/shipping',shipping);app.use('/api/reviews',reviews);app.use('/api/orders',orders);app.use('/api/settings',settings);app.use(errorHandler);if (!process.env.VERCEL) { app.listen(env.PORT, '0.0.0.0', () => console.log(`Sell Wave API listening on ${env.PORT}`)); }
export default app;
