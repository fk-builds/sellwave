# Sell Wave — production website

Single-owner Pakistani mega-store. No sample products, no fake orders, no simulated payments — everything you publish here is real business data.

## What is built

**Customer website (React + Vite)**
- 8-banner premium homepage carousel, shop-by-category tiles, featured products.
- Shop with search, category chips and featured filter; product pages with image gallery, size/colour options, live stock, ratings & approved reviews, review submission after delivery.
- Cart (per-option stock checked), checkout with saved addresses, promo codes, Wave Points redemption, COD (JazzCash/Easypaisa appear but activate only after real merchant credentials).
- Account: order tracking timeline, printable order receipts, Wave Points balance + ledger, 7-day return requests with status tracking, wishlist.
- WhatsApp support (0311 9579613) and returns policy pages.

**API (Node + Express + TypeScript + Prisma + PostgreSQL)**
- Cookie-based JWT auth (bcrypt, httpOnly), role-based admin/staff access.
- Catalog with variants (per-option SKU, price override, stock), images, featured flags.
- Checkout transaction: stock decrement, coupon validation + one-time redemption per customer, Wave Points redeem (1 pt = PKR 1, capped at half of subtotal), ledger entries.
- On delivery: Wave Points auto-award (1 pt per PKR 100), COD marked PAID. On cancel/refund: points reversed exactly once.
- Reviews (verified-purchase only, moderated), returns (7-day window enforced), coupons, shipping zones + weight-based rates, site settings, audit log on every admin write.

**Admin panel** (tabs): Overview metrics · Catalog (products, publish, feature, image manager, option/variant manager) · Orders (status workflow + COD confirmation note) · Coupons · Review moderation · Returns management · Shipping zones & rates.

## Local development

1. Install Node.js 20+ and Docker (or any PostgreSQL 14+).
2. `cd sellwave && cp .env.example .env` — set your own secure values (see below).
3. `docker compose up -d` (starts PostgreSQL)
4. `npm install`
5. `npm run db:generate && npm run db:migrate && npm run seed` — creates your admin account from `.env`.
6. `npm run dev` — website on http://localhost:5173, API on http://localhost:4000.

### .env keys
| Key | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | 32+ random chars session secret |
| `CLIENT_ORIGIN` | Website URL (for cookies/CORS) |
| `COOKIE_SECURE` | `true` in production (HTTPS) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Owner admin login (used by seed) |
| `SEED_TEMPORARY_CATALOG` | keep `false` — only for throwaway tests |
| `JAZZCASH_*` / `EASYPAISA_*` | empty until merchant onboarding is done |

## Going live (owner steps)

1. **Provision PostgreSQL** (Hostinger VPS package with Postgres, or a managed DB such as Neon/Supabase).
2. **Load the database**: `npm run db:migrate` then `npm run seed` (uses `.env` values).
3. **Build**: `npm install && npm run db:generate && npm run build`.
4. **Serve**: run the API with any process manager (`node server/dist/index.js`, pm2/systemd) behind HTTPS; host `web/dist/` as static files (Hostinger static hosting, Nginx, or Vercel).
5. Point the frontend to the API: for split hosting set the API URL (e.g. `https://api.yourdomain.pk`) and update `CLIENT_ORIGIN` to the website URL; for same-domain hosting, reverse-proxy `/api` to the Node process (example Nginx config below).
6. Set `COOKIE_SECURE=true` and a fresh `JWT_SECRET`.
7. **Payments**: complete JazzCash/Easypaisa merchant onboarding, then the integration (signed requests + verified webhooks) is enabled — nothing is simulated meanwhile.

Nginx same-domain example:
```nginx
location /api { proxy_pass http://127.0.0.1:4000; proxy_set_header Host $host; }
location / { root /var/www/sellwave/web/dist; try_files $uri /index.html; }
```

## Loyalty rules (Wave Points)
Defaults live in `server/src/utils/loyalty.ts` and the seeded `store` SiteSetting: earn 1 pt / PKR 100 on delivered orders, redeem 1 pt = PKR 1, max 50% of subtotal. Change them in one place and both server and seed stay consistent.
