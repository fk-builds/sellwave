import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const r = Router();
r.use(requireAuth, requireRole('ADMIN', 'STAFF'));

// Status check — admin panel is batata hai upload available hai ya nahi
r.get('/status', async (_q, res) => {
  res.json({ available: Boolean(env.SUPABASE_SECRET_KEY), bucket: 'products', maxBytes: 3_000_000 });
});

// Image upload: base64 data URL → Supabase Storage (public bucket)
r.post('/', async (req, res, next) => {
  try {
    if (!env.SUPABASE_SECRET_KEY) return res.status(503).json({ message: 'Upload configured nahi hai — Supabase secret key missing.' });
    const d = z.object({
      filename: z.string().min(1).max(120),
      data: z.string().startsWith('data:image/').max(5_000_000),
    }).parse(req.body);

    const b64 = d.data.split(',')[1] ?? '';
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length < 1000) return res.status(400).json({ message: 'File bohot choti/corrupt hai.' });
    if (buffer.length > 3_000_000) return res.status(400).json({ message: 'Image 3MB se choti honi chahiye. Pehle compress karein (tinypng.com).' });

    const mimeMatch = d.data.match(/^data:(image\/(?:jpeg|png|webp|avif));base64,/);
    if (!mimeMatch) return res.status(400).json({ message: 'Sirf JPG/PNG/WebP/AVIF images allowed hain.' });
    const mime = mimeMatch[1];
    const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];

    const path = `p/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const res2 = await fetch(`${env.SUPABASE_URL}/storage/v1/object/products/${path}`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        'Content-Type': mime,
        'Cache-Control': '31536000',
      },
      body: new Uint8Array(buffer),
    });
    if (!res2.ok) {
      const t = await res2.text();
      return res.status(502).json({ message: `Storage upload fail: ${t.slice(0, 140)}` });
    }
    res.status(201).json({ url: `${env.SUPABASE_URL}/storage/v1/object/public/products/${path}`, bytes: buffer.length });
  } catch (e) { next(e); }
});

export default r;
