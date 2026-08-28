import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { env } from '../config/env.js';

const r = Router();

const setCookie = (res: import('express').Response, id: string, role: string) =>
  res.cookie('access_token', jwt.sign({ id, role }, env.JWT_SECRET, { expiresIn: '7d' }), {
    httpOnly: true,
    secure: env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: 604800000,
  });

const cleanEmail = (raw: unknown) => String(raw ?? '').trim().toLowerCase();

/**
 * POST /api/auth/otp/send  { email, firstName?, lastName? }
 * Sends a 6-digit code to the email (via Resend). Customer account is created
 * automatically on first request if it doesn't exist (passwordless onboarding).
 */
r.post('/otp/send', async (req, res, next) => {
  try {
    const d = z.object({
      email: z.string().email().max(120),
      firstName: z.string().min(1).max(50).optional(),
      lastName: z.string().min(1).max(50).optional(),
    }).parse(req.body);
    const email = cleanEmail(d.email);

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const first = d.firstName || email.split('@')[0].slice(0, 30);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: await import('bcryptjs').then(b => b.hash(jwt.sign({ rnd: email }, env.JWT_SECRET), 12)), // random unusable hash
          firstName: first,
          lastName: d.lastName || '.',
          role: 'CUSTOMER',
        },
      });
    }
    if (!user.isActive) return res.status(403).json({ message: 'This account is suspended. Contact support.' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: code, otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });

    // Send via Resend REST (no SDK). Onboarding sender works for the owner address;
    // once the sending domain is verified this reaches any customer.
    try {
      const res3 = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: email,
          subject: `${code} is your Sell Wave login code`,
          html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
            <div style="background:#101827;color:#fff;padding:16px 22px;font-weight:800;letter-spacing:2px">SELLWAVE</div>
            <div style="border:1px solid #e7e6e0;border-top:0;padding:26px;line-height:1.7">
              <h2 style="margin:0 0 10px">Your login code</h2>
              <p style="font-size:14px;color:#637083">Use this 6-digit code to sign in. It expires in 10 minutes.</p>
              <div style="font-size:34px;font-weight:800;letter-spacing:10px;background:#f4f5f7;padding:16px;text-align:center;margin:14px 0">${code}</div>
              <p style="font-size:12px;color:#637083">Didn't request this? You can safely ignore this email.</p>
            </div>
          </div>`,
        }),
      });
      if (!res3.ok) {
        const t = await res3.text();
        console.error('[otp] resend error:', t.slice(0, 200));
        // Owner address fallback: log the code to server console so owner can still test
        if (res3.status === 403) {
          console.log(`[otp] RESEND-403 fallback — code for ${email}: ${code}`);
        }
      }
    } catch (e) {
      console.error('[otp] email send failed:', e);
    }

    res.json({ ok: true, message: 'Code sent to your email. It expires in 10 minutes.' });
  } catch (e) { next(e); }
});

/**
 * POST /api/auth/otp/verify  { email, code, firstName?, lastName? }
 * Verifies the code, marks verified, issues session.
 */
r.post('/otp/verify', async (req, res, next) => {
  try {
    const d = z.object({
      email: z.string().email(),
      code: z.string().regex(/^\d{6}$/),
      firstName: z.string().min(1).max(50).optional(),
      lastName: z.string().min(1).max(50).optional(),
    }).parse(req.body);
    const email = cleanEmail(d.email);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'Code expired ya galat hai — naya code mangwayein.' });
    }
    if (user.otpCode !== d.code) return res.status(400).json({ message: 'Ghalat code. Dobara check karein.' });

    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpiresAt: null, emailVerifiedAt: new Date() },
    });
    setCookie(res, user.id, user.role);
    res.json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } });
  } catch (e) { next(e); }
});

/**
 * GET /api/auth/google/start → redirect to Google consent
 * GET /api/auth/google/callback?code=... → issue session cookie
 * Uses GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars (owner creates these in Google Cloud).
 */
r.get('/google/start', (req, res) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return res.status(501).send('Google sign-in is not configured yet. Use email code login.');
  }
  const redirectUri = `${env.API_BASE_URL || 'https://sellwave-roan.vercel.app'}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

r.get('/google/callback', async (req, res, next) => {
  try {
    const code = String(req.query.code || '');
    if (!code || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return res.status(400).send('Missing code or config.');
    const redirectUri = `${env.API_BASE_URL || 'https://sellwave-roan.vercel.app'}/api/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) return res.status(400).send('Google token exchange failed.');

    const profRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const prof = (await profRes.json()) as { email?: string; verified_email?: boolean; name?: string; given_name?: string; family_name?: string; id?: string };
    const email = cleanEmail(prof.email);
    if (!email) return res.status(400).send('No email in Google profile.');

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: await import('bcryptjs').then(b => b.hash(jwt.sign({ rnd: email, g: 1 }, env.JWT_SECRET), 12)),
          firstName: prof.given_name || prof.name?.split(' ')[0] || email.split('@')[0].slice(0, 30),
          lastName: prof.family_name || prof.name?.split(' ').slice(1).join(' ') || '.',
          googleId: prof.id ?? null,
          emailVerifiedAt: new Date(),
          role: 'CUSTOMER',
        },
      });
    } else if (!user.googleId) {
      await prisma.user.update({ where: { id: user.id }, data: { googleId: prof.id ?? null, emailVerifiedAt: new Date() } });
    }
    setCookie(res, user.id, user.role);
    res.redirect('/dashboard');
  } catch (e) { next(e); }
});

export default r;
