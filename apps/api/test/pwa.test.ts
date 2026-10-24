import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const PUBLIC = path.resolve(__dirname, '../../web/public');
const read = (f: string) => readFileSync(path.join(PUBLIC, f), 'utf8');

type Strategy = 'bypass' | 'shell' | 'cache-first-immutable' | 'cache-first-image' | 'network-first-api' | 'stale-while-revalidate';
// The rules file is browser code with no module system; evaluate it the way a worker would.
const sandbox: { self: { SANGHA_SW_RULES?: { strategyFor: (r: object) => Strategy } }; URL: typeof URL } = { self: {}, URL };
vm.runInNewContext(read('sw-rules.js'), sandbox);
const ORIGIN = 'https://sangha.example';
const rule = (p: string, over: Record<string, string> = {}): Strategy =>
  sandbox.self.SANGHA_SW_RULES!.strategyFor({ url: ORIGIN + p, method: 'GET', origin: ORIGIN, mode: 'cors', destination: '', ...over });

describe('service worker caching rules', () => {
  it('serves public pages and data from a saved copy when offline', () => {
    for (const p of ['/api/home', '/api/events', '/api/events?when=past', '/api/events/rajyotsava-ab12', '/api/blogs', '/api/blogs/why-we-celebrate', '/api/gallery', '/api/gallery/66aa', '/api/board', '/api/settings', '/api/credits']) {
      expect(rule(p), p).toBe('network-first-api');
    }
    // Bank details are always fetched live: an old IBAN must never be shown from a saved copy.
    expect(rule('/api/payment')).toBe('bypass');
    expect(rule('/events', { mode: 'navigate' })).toBe('shell');
    expect(rule('/', { mode: 'navigate' })).toBe('shell');
    expect(rule('/assets/index-AbC123.js')).toBe('cache-first-immutable');
    expect(rule('/uploads/seed-banner.jpg', { destination: 'image' })).toBe('cache-first-image');
    expect(rule('/icons/icon-192.png', { destination: 'image' })).toBe('stale-while-revalidate');
  });

  it('never touches anything personal, authenticated or state-changing', () => {
    for (const p of ['/api/admin/registrations', '/api/admin/stats', '/api/auth/me', '/api/registrations/KS-ABC123', '/api/registrations/KS-ABC123/proof', '/api/upload', '/api/contributions']) {
      expect(rule(p), p).toBe('bypass');
    }
    // Unknown API paths default to the network too: a new endpoint is private until someone allow-lists it.
    expect(rule('/api/new-private-thing')).toBe('bypass');
  });

  it('only caches GET requests, and only from our own origin', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(rule('/api/events/x/register', { method })).toBe('bypass');
      expect(rule('/api/home', { method })).toBe('bypass');
    }
    expect(rule('/x.js', { origin: 'https://other.example' })).toBe('bypass');
    expect(sandbox.self.SANGHA_SW_RULES!.strategyFor({ url: 'https://fonts.gstatic.com/a.woff2', method: 'GET', origin: ORIGIN })).toBe('bypass');
  });

  it('never stores an upload that was opened directly (e.g. an admin viewing a payment screenshot)', () => {
    expect(rule('/uploads/abc.png', { destination: 'document', mode: 'navigate' })).toBe('bypass');
    expect(rule('/uploads/abc.png', { destination: '' })).toBe('bypass');
  });

  it('keeps the worker, health check and login-related paths out of the cache', () => {
    expect(rule('/sw.js')).toBe('bypass');
    expect(rule('/sw-rules.js')).toBe('bypass');
    expect(rule('/healthz')).toBe('bypass');
  });
});

describe('PWA files', () => {
  const pngSize = (f: string) => {
    const b = readFileSync(path.join(PUBLIC, 'icons', f));
    expect(b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `${f} is a PNG`).toBe(true);
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };

  it('has a manifest an installable app needs', () => {
    const m = JSON.parse(read('manifest.webmanifest'));
    expect(m.name).toBeTruthy();
    expect(m.short_name.length).toBeLessThanOrEqual(12);
    expect(m.display).toBe('standalone');
    expect(m.start_url).toMatch(/^\//);
    expect(m.scope).toBe('/');
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    const has = (size: string, purpose: string) => m.icons.some((i: { sizes: string; purpose: string }) => i.sizes === size && i.purpose === purpose);
    expect(has('192x192', 'any')).toBe(true);
    expect(has('512x512', 'any')).toBe(true);
    expect(has('512x512', 'maskable')).toBe(true);
  });

  it('has icon files that exist and are exactly the size the manifest claims', () => {
    const m = JSON.parse(read('manifest.webmanifest'));
    for (const i of m.icons as Array<{ src: string; sizes: string }>) {
      const [w, h] = i.sizes.split('x').map(Number);
      expect(pngSize(path.basename(i.src)), i.src).toEqual([w, h]);
    }
    expect(pngSize('apple-touch-icon.png')).toEqual([180, 180]);
  });

  it('links the manifest and icons from the page, and ships an offline page', () => {
    const html = readFileSync(path.resolve(PUBLIC, '../index.html'), 'utf8');
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="theme-color"');
    expect(read('offline.html')).toContain("You're offline");
  });

  it('precaches only files that exist, and the worker never mentions private endpoints', () => {
    const sw = read('sw.js');
    const list = sw.match(/var PRECACHE = \[([^\]]+)\]/)![1]!;
    for (const url of list.match(/'([^']+)'/g)!.map((s) => s.slice(1, -1))) {
      if (url === '/') continue; // the page shell, served by the app
      expect(() => readFileSync(path.join(PUBLIC, url)), `${url} is precached but missing`).not.toThrow();
    }
    expect(sw).not.toMatch(/\/api\/(admin|auth)/);
  });
});
