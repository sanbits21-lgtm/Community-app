import { randomBytes } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { config } from './config';

mkdirSync(config.uploadDir, { recursive: true });
mkdirSync(config.privateDir, { recursive: true });

// Extension comes from the validated mime type, never from the client's filename.
const EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = (dir: string) =>
  multer.diskStorage({
    destination: dir,
    filename: (_req, file, cb) => cb(null, randomBytes(12).toString('hex') + (EXT[file.mimetype] ?? '')),
  });
const imagesOnly: multer.Options['fileFilter'] = (_req, file, cb) => cb(null, file.mimetype in EXT);

// Admins publish photos for the website: several at a time, fairly large.
const adminMulter = multer({ storage: storage(config.uploadDir), limits: { fileSize: 6 * 1024 * 1024, files: 20 }, fileFilter: imagesOnly });
// The public can attach ONE payment screenshot, into a private folder.
const proofMulter = multer({ storage: storage(config.privateDir), limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: imagesOnly });

/** The mime type is whatever the client claimed, so check the file's actual first bytes too. */
function looksLikeImage(file: string): boolean {
  const buf = Buffer.alloc(12);
  const fd = openSync(file, 'r');
  try {
    readSync(fd, buf, 0, 12, 0);
  } finally {
    closeSync(fd);
  }
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const gif = buf.subarray(0, 4).toString('latin1') === 'GIF8';
  const webp = buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  return jpeg || png || gif || webp;
}

function finish(urlFor: (name: string) => string): RequestHandler {
  return (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[];
    if (!files.every((f) => looksLikeImage(f.path))) {
      for (const f of files) unlinkSync(f.path);
      res.status(400).json({ error: 'That file is not a real image (jpg, png, webp or gif)' });
      return;
    }
    if (files.length === 0) {
      res.status(400).json({ error: 'Send an image (jpg, png, webp or gif)' });
      return;
    }
    res.status(201).json({ urls: files.map((f) => urlFor(path.basename(f.path))) });
  };
}

/** Admin: up to 20 website photos, served publicly from /uploads. */
export const imageUpload: RequestHandler[] = [adminMulter.array('files', 20), finish((n) => `/uploads/${n}`)];

/** Public: exactly one payment screenshot, stored privately and only reachable by signed-in admins. */
export const proofUpload: RequestHandler[] = [proofMulter.array('files', 1), finish((n) => `/api/admin/proofs/${n}`)];

export const PROOF_NAME = /^[0-9a-f]{24}\.(jpg|png|webp|gif)$/;
