import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { changePasswordInput, loginInput } from '@sangha/shared';
import { config } from './config';
import { Admin, RevokedToken } from './models';

export const COOKIE = 'sangha_token';
export const parseCookies = cookieParser();

interface Session {
  id: string;
  role: 'owner' | 'admin';
  jti: string;
  exp: number;
}

/** What is inside the signed cookie. The role is deliberately NOT here: it is always read from the database. */
interface Claims {
  id: string;
  tv: number;
  jti: string;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      admin?: Session;
    }
  }
}

function setSession(res: Response, admin: { id: string; tokenVersion?: number | null }): void {
  const token = jwt.sign({ id: admin.id, tv: admin.tokenVersion ?? 0, jti: randomUUID() }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 7 * 24 * 3600 * 1000 });
}

function readClaims(token: string): Claims {
  const c = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as Claims;
  if (!c.id || !c.jti || typeof c.tv !== 'number') throw new Error('unrecognised token');
  return c;
}

/**
 * A valid signature is not enough: the account must still exist, the token must be from the current password
 * generation, and it must not have been signed out. So deleting an admin or changing a password takes effect at once.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[COOKIE] as string | undefined;
    if (!token) throw new Error('no token');
    const c = readClaims(token);
    const [admin, revoked] = await Promise.all([Admin.findById(c.id).select('role tokenVersion').lean(), RevokedToken.exists({ jti: c.jti })]);
    if (!admin || revoked || (admin.tokenVersion ?? 0) !== c.tv) throw new Error('session ended');
    req.admin = { id: c.id, role: admin.role as 'owner' | 'admin', jti: c.jti, exp: c.exp ?? 0 };
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in' });
  }
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (req.admin?.role !== 'owner') {
    res.status(403).json({ error: 'Only the owner can do this' });
    return;
  }
  next();
}

// A real bcrypt hash, so a login for an unknown email costs the same time as a wrong password
// (a malformed hash is rejected instantly and would reveal which emails are admins).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// Slow down password guessing without locking out the real admin for long.
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

export const authRouter = Router();

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginInput.parse(req.body);
  const admin = await Admin.findOne({ email });
  // Compare even when the user is missing so response time doesn't reveal which emails exist.
  const hash = admin?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!admin || !ok) {
    res.status(401).json({ error: 'Wrong email or password' });
    return;
  }
  setSession(res, admin);
  res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
});

// Signing out must really end the session: remember this token as revoked until it would have expired anyway.
authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.[COOKIE] as string | undefined;
  if (token) {
    try {
      const c = readClaims(token);
      if (c.exp) await RevokedToken.updateOne({ jti: c.jti }, { $setOnInsert: { jti: c.jti, expiresAt: new Date(c.exp * 1000) } }, { upsert: true });
    } catch {
      /* already invalid: nothing to revoke */
    }
  }
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

authRouter.post('/password', loginLimiter, requireAdmin, async (req, res) => {
  const { current, next } = changePasswordInput.parse(req.body);
  const admin = await Admin.findById(req.admin!.id);
  if (!admin || !(await bcrypt.compare(current, admin.passwordHash))) {
    res.status(400).json({ error: 'Your current password is not right' });
    return;
  }
  admin.passwordHash = await hashPassword(next);
  // Every other signed-in device (including a thief's) is ended; this one gets a fresh token and stays in.
  admin.tokenVersion = (admin.tokenVersion ?? 0) + 1;
  await admin.save();
  setSession(res, admin);
  res.json({ ok: true });
});

authRouter.get('/me', requireAdmin, async (req, res) => {
  const admin = await Admin.findById(req.admin!.id);
  if (!admin) {
    res.status(401).json({ error: 'Please sign in' });
    return;
  }
  res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
});

/** First boot: create the owner from env so a fresh deploy is never locked out. */
export async function ensureOwner(): Promise<void> {
  if (await Admin.exists({})) return;
  await Admin.create({
    email: config.adminEmail.toLowerCase(),
    name: 'Owner',
    role: 'owner',
    passwordHash: await bcrypt.hash(config.adminPassword, 10),
  });
  console.log(`[auth] created owner account ${config.adminEmail} — change the password.`);
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
