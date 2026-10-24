import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { authRouter, parseCookies } from './auth';
import { config } from './config';
import { adminRouter } from './routes/admin';
import { publicRouter } from './routes/public';

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    res.status(400).json({
      error: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input',
      issues: err.issues,
    });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  if (err instanceof Error && err.name === 'MulterError') {
    res.status(400).json({ error: err.message });
    return;
  }
  // Errors raised by the framework itself (malformed JSON, body too large...) carry their own 4xx status.
  const status = (err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const message = status === 413 ? 'That request is too large' : status === 415 ? 'Unsupported content type' : 'Invalid request';
    res.status(status).json({ error: message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
};

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);
  app.use(
    helmet({
      // Uploaded images are shown by the SPA, which may be served from another origin in dev.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
        },
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(parseCookies);

  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', setHeaders: (r) => r.setHeader('X-Content-Type-Options', 'nosniff') }));
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', publicRouter);
  app.use('/api', (_req, res) => void res.status(404).json({ error: 'Not found' }));

  // One-process deploy: serve the built SPA, with history-API fallback for client routes.
  if (existsSync(path.join(config.webDist, 'index.html'))) {
    app.use(
      express.static(config.webDist, {
        setHeaders: (res, file) => {
          const f = file.replace(/\\/g, '/');
          // Files in /assets have their content hash in the name, so they can be kept for a year.
          if (f.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          // The worker and the page shell must always be re-checked, or an update could never reach phones.
          else if (/\/(sw\.js|sw-rules\.js|index\.html|offline\.html|manifest\.webmanifest)$/.test(f)) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    // Real pages get the app; anything else gets the same app with a 404 status, so search engines don't index "not found".
    const KNOWN = /^\/(events|blog|gallery|journey|board|contribute|contact|credits|my|registration|admin)(\/|$)/;
    app.get('/{*splat}', (req, res) => res.status(req.path === '/' || KNOWN.test(req.path) ? 200 : 404).sendFile(path.join(config.webDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
