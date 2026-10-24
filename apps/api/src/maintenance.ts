import { readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import mongoose, { type Model } from 'mongoose';
import { config } from './config';
import { Contribution, Registration } from './models';
import { PROOF_NAME } from './uploads';

const DAY = 86_400_000;

/** Every file name the database still points to, found by scanning every text value in every collection. */
async function referencedNames(): Promise<{ uploads: Set<string>; proofs: Set<string> }> {
  const uploads = new Set<string>();
  const proofs = new Set<string>();
  const scan = (v: unknown): void => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(/\/uploads\/([\w.-]+)/g)) uploads.add(m[1]!);
      for (const m of v.matchAll(/\/api\/admin\/proofs\/([\w.-]+)/g)) proofs.add(m[1]!);
    } else if (Array.isArray(v)) v.forEach(scan);
    else if (v && typeof v === 'object') Object.values(v).forEach(scan);
  };
  const db = mongoose.connection.db!;
  for (const c of await db.listCollections().toArray()) {
    for await (const doc of db.collection(c.name).find()) scan(doc);
  }
  return { uploads, proofs };
}

function removeOld(dir: string, keep: (name: string) => boolean, cutoff: number): number {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    const st = statSync(file);
    if (!st.isFile() || st.mtimeMs > cutoff || keep(name)) continue;
    unlinkSync(file);
    n++;
  }
  return n;
}

/**
 * Housekeeping, run daily:
 *  1. photos that nothing uses any more (deleted banners, abandoned forms) are removed after a grace period;
 *  2. payment screenshots nobody attached to a payment are removed after the same period;
 *  3. screenshots of payments that are already settled are removed after the retention period (privacy).
 * Sample photos (seed-*) are never touched.
 */
export async function cleanupUploads(now = Date.now()): Promise<{ photos: number; strayProofs: number; settledProofs: number }> {
  const grace = now - config.uploadGraceDays * DAY;
  const refs = await referencedNames();

  // 3: settled payments. Delete exactly those files by name; never widen the sweep below to "everything unattached".
  let settledProofs = 0;
  const retention = new Date(now - config.proofRetentionDays * DAY);
  // biome-ignore lint/suspicious/noExplicitAny: both models share the same screenshot/status fields
  for (const model of [Registration, Contribution] as Array<Model<any>>) {
    const old = await model.find({ screenshot: { $ne: '' }, status: { $ne: 'pending' }, updatedAt: { $lt: retention } }).select('_id screenshot').lean();
    for (const d of old) {
      const name = /\/api\/admin\/proofs\/([\w.-]+)/.exec(d.screenshot ?? '')?.[1];
      if (name && PROOF_NAME.test(name)) {
        try {
          unlinkSync(path.join(config.privateDir, name));
        } catch {
          /* already gone */
        }
      }
      await model.updateOne({ _id: d._id }, { $set: { screenshot: '' } }, { timestamps: false });
      settledProofs++;
    }
  }

  const photos = removeOld(config.uploadDir, (n) => n.startsWith('seed-') || refs.uploads.has(n), grace);
  // 2: only files that are BOTH unattached and older than the grace period (a screenshot uploaded a minute ago is kept).
  const strayProofs = removeOld(config.privateDir, (n) => refs.proofs.has(n), grace);
  return { photos, strayProofs, settledProofs };
}

/** First run a minute after start-up, then daily. Never throws and never keeps the process alive. */
export function scheduleCleanup(): void {
  const run = () => cleanupUploads().then((r) => (r.photos || r.strayProofs || r.settledProofs) && console.log('[cleanup]', r)).catch((e) => console.error('[cleanup] failed:', e));
  setTimeout(run, 60_000).unref();
  setInterval(run, DAY).unref();
}
