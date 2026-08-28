import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';

const r = Router();
r.use(requireAuth, requireRole('ADMIN', 'STAFF'));

const MAX = 50 * 1024 * 1024; // 50MB

// POST /api/admin/media/video?productId=... { filename, data(dataURL) } → uploads to Supabase Storage and creates ProductVideo
r.post('/video', async (req, res, next) => {
  try {
    const productId = String(req.query.productId || '');
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    if (!env.SUPABASE_SECRET_KEY) return res.status(503).json({ message: 'Storage not configured.' });

    const d = z.object({
      filename: z.string().min(1).max(140),
      data: z.string().startsWith('data:video/').max(MAX + 200_000),
    }).parse(req.body);

    const m = d.data.match(/^data:(video\/(?:mp4|webm));base64,/);
    if (!m) return res.status(400).json({ message: 'Only .mp4 / .webm allowed.' });
    const mime = m[1];
    const ext = mime === 'video/mp4' ? 'mp4' : 'webm';

    const buf = Buffer.from(d.data.split(',')[1] ?? '', 'base64');
    if (buf.length > MAX) return res.status(400).json({ message: 'Max 50MB.' });
    if (buf.length < 10_000) return res.status(400).json({ message: 'File too small/corrupt.' });

    const path = `v/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await fetch(`${env.SUPABASE_URL}/storage/v1/object/videos/${path}`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        'Content-Type': mime,
        'Cache-Control': '31536000',
      },
      body: new Uint8Array(buf),
    });
    if (!up.ok) {
      const t = await up.text();
      return res.status(502).json({ message: `Storage upload failed: ${t.slice(0, 140)}` });
    }

    const url = `${env.SUPABASE_URL}/storage/v1/object/public/videos/${path}`;
    const count = await prisma.productVideo.count({ where: { productId } });
    const v = await prisma.productVideo.create({
      data: { productId, kind: 'upload', url, sortOrder: count },
    });
    res.status(201).json({ video: v, bytes: buf.length });
  } catch (e) { next(e); }
});

export default r;
