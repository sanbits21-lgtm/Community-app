import { existsSync } from 'node:fs';
import path from 'node:path';
import { strongPassword } from '@sangha/shared';

// Node 24 reads .env natively; try the workspace root, then the app folder.
for (const p of ['../../.env', '.env']) {
  const file = path.resolve(process.cwd(), p);
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

const isProd = process.env.NODE_ENV === 'production';

function required(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (isProd) throw new Error(`${name} must be set in production`);
  return devDefault;
}

export const config = {
  isProd,
  /**
   * For showing the site to a customer on a free host: sample content is restored on start-up, the site says it is a
   * demo, and the owner gets a "reset demo data" button. NEVER switch this on for a real site: the reset erases data.
   */
  demoMode: process.env.DEMO_MODE === 'true',
  port: Number(process.env.PORT ?? 4000),
  /** Empty means "start a throwaway-but-persistent local Mongo" (dev only). */
  mongoUri: process.env.MONGODB_URI ?? '',
  jwtSecret: required('JWT_SECRET', 'dev-only-secret-change-me'),
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@sangha.local',
  adminPassword: required('ADMIN_PASSWORD', 'ChangeMe123!'),
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
  /** Payment screenshots. NOT served publicly: only signed-in admins can open them (see routes/admin.ts). */
  privateDir: path.resolve(process.cwd(), process.env.PRIVATE_DIR ?? 'private-uploads'),
  /** Files nothing points to are deleted after this many days (a grace period for forms left half-filled). */
  uploadGraceDays: Number(process.env.UPLOAD_GRACE_DAYS ?? 7),
  /** Screenshots of settled (verified/rejected) payments are deleted after this many days. */
  proofRetentionDays: Number(process.env.PROOF_RETENTION_DAYS ?? 30),
  /** Optional. e.g. smtp://user:pass@smtp.example.com:587 . Without it, no emails are sent. */
  smtpUrl: process.env.SMTP_URL ?? '',
  mailFrom: process.env.MAIL_FROM ?? 'Kannada Sangha <no-reply@localhost>',
  /** Used for links in emails. */
  publicUrl: (process.env.PUBLIC_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  /** Number of reverse proxies in front of the app (Caddy = 1). Needed for correct client IPs / rate limits. */
  trustProxy: Number(process.env.TRUST_PROXY ?? (isProd ? 1 : 0)),
  webDist: path.resolve(process.cwd(), process.env.WEB_DIST ?? '../web/dist'),
};

// A short secret lets anyone forge admin sign-ins; a weak first password is the first thing an attacker tries.
if (isProd) {
  const problems: string[] = [];
  if (config.jwtSecret.length < 32) problems.push('JWT_SECRET must be at least 32 characters (generate one with: openssl rand -hex 48)');
  const pw = strongPassword.safeParse(config.adminPassword);
  if (!pw.success) problems.push(`ADMIN_PASSWORD: ${pw.error.issues[0]?.message ?? 'not strong enough'}`);
  if (problems.length) throw new Error(`Refusing to start in production:\n - ${problems.join('\n - ')}`);
}
