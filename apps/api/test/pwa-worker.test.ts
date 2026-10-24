import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Runs the real public/sw.js against an in-memory stand-in for the browser's CacheStorage and fetch,
 * so offline behaviour is checked automatically (no browser, no network).
 */
const PUBLIC = path.resolve(__dirname, '../../web/public');
const read = (f: string) => readFileSync(path.join(PUBLIC, f), 'utf8');
const ORIGIN = 'https://sangha.example';

const abs = (k: string | { url: string }) => {
  const u = typeof k === 'string' ? k : k.url;
  return u.startsWith('/') ? ORIGIN + u : u;
};

class MemCache {
  entries = new Map<string, Response>();
  async put(k: string | { url: string }, r: Response) {
    this.entries.set(abs(k), r);
  }
  async match(k: string | { url: string }) {
    return this.entries.get(abs(k))?.clone();
  }
  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }));
  }
  async delete(k: string | { url: string }) {
    return this.entries.delete(abs(k));
  }
}

class MemCaches {
  stores = new Map<string, MemCache>();
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new MemCache());
    return this.stores.get(name)!;
  }
  async keys() {
    return [...this.stores.keys()];
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
  async match(k: string | { url: string }) {
    for (const s of this.stores.values()) {
      const hit = await s.match(k);
      if (hit) return hit;
    }
    return undefined;
  }
}

type Handler = (e: unknown) => void;
type FetchImpl = (req: { url: string }) => Promise<Response>;

function makeWorker(network: { impl: FetchImpl; calls: string[] }) {
  const listeners: Record<string, Handler[]> = {};
  const caches = new MemCaches();
  const skipWaiting = vi.fn();
  const claim = vi.fn(async () => undefined);
  const self = {
    addEventListener: (t: string, f: Handler) => void (listeners[t] ??= []).push(f),
    location: { origin: ORIGIN },
    skipWaiting,
    clients: { claim },
  };
  const ctx = vm.createContext({
    self,
    caches: Object.assign(caches, {}),
    // Cache.addAll isn't on MemCache; the worker calls it during install, so provide it here.
    fetch: (req: { url: string } | string) => {
      const r = typeof req === 'string' ? { url: abs(req) } : req;
      network.calls.push(r.url);
      return network.impl(r);
    },
    Response,
    URL,
    Promise,
    JSON,
    Object,
    Math,
    Error,
    setTimeout: (...a: Parameters<typeof setTimeout>) => setTimeout(...a),
    clearTimeout: (...a: Parameters<typeof clearTimeout>) => clearTimeout(...a),
    importScripts: (p: string) => vm.runInContext(read(p.replace(/^\//, '')), ctx),
  });
  // addAll needs the worker's fetch, so patch it onto every cache the worker opens.
  const origOpen = caches.open.bind(caches);
  caches.open = async (name: string) => {
    const c = (await origOpen(name)) as MemCache & { addAll?: (urls: string[]) => Promise<void> };
    c.addAll ??= async (urls: string[]) => {
      for (const u of urls) {
        const res = await (ctx.fetch as (r: string) => Promise<Response>)(u);
        if (!res.ok) throw new Error(`precache failed: ${u}`);
        await c.put(u, res);
      }
    };
    return c;
  };
  vm.runInContext(read('sw.js'), ctx);

  const dispatch = async (type: string, event: Record<string, unknown>) => {
    const waits: Promise<unknown>[] = [];
    let responded: Promise<Response> | undefined;
    const e = { ...event, waitUntil: (p: Promise<unknown>) => void waits.push(p), respondWith: (p: Promise<Response>) => void (responded = p) };
    for (const h of listeners[type] ?? []) h(e);
    const out = responded ? await responded : undefined;
    // Like a browser, keep going until every write the worker registered has finished.
    for (let n = 0; n < waits.length; n++) await waits[n];
    return out;
  };

  return {
    caches,
    skipWaiting,
    claim,
    install: () => dispatch('install', {}),
    activate: () => dispatch('activate', {}),
    message: (data: unknown) => dispatch('message', { data }),
    /** Returns the response the worker produced, or `undefined` when it left the request to the browser. */
    async request(p: string, over: { method?: string; mode?: string; destination?: string } = {}) {
      const request = { url: ORIGIN + p, method: over.method ?? 'GET', mode: over.mode ?? 'cors', destination: over.destination ?? '' };
      return dispatch('fetch', { request });
    },
  };
}

const page = (body: string, headers: Record<string, string> = { 'Content-Type': 'text/html' }) => new Response(body, { status: 200, headers });
const json = (obj: unknown) => new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } });

let online = true;
const defaultImpl: FetchImpl = (async (req: { url: string }) => {
  if (!online) throw new TypeError('Failed to fetch');
  const p = new URL(req.url).pathname;
  if (p === '/' || p === '/events') return page('<html>LIVE SHELL</html>');
  if (p === '/offline.html') return page('<html>OFFLINE PAGE</html>');
  if (p.startsWith('/api/')) return json({ live: true, path: p });
  if (p.startsWith('/uploads/') || p.startsWith('/icons/')) return new Response('img', { status: 200, headers: { 'Content-Type': 'image/png' } });
  if (p.startsWith('/assets/')) return new Response('js', { status: 200, headers: { 'Content-Type': 'text/javascript' } });
  return new Response('x', { status: 200 });
}) as FetchImpl;
const net = { calls: [] as string[], impl: defaultImpl };

beforeEach(() => {
  online = true;
  net.calls = [];
  net.impl = defaultImpl;
});
afterEach(() => vi.useRealTimers());

describe('service worker behaviour (real sw.js, simulated browser)', () => {
  it('saves the app shell and offline page when it installs, and does not hijack the page on its own', async () => {
    const w = makeWorker(net);
    await w.install();
    const shell = await w.caches.open('sangha-shell-v2');
    expect([...shell.entries.keys()].sort()).toEqual(
      ['/', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest', '/offline.html', '/theme-init.js'].map((p) => ORIGIN + p).sort(),
    );
    expect(w.skipWaiting).not.toHaveBeenCalled(); // updates wait for the visitor's "Refresh"
  });

  it('shows the live page when online and refreshes the saved copy', async () => {
    const w = makeWorker(net);
    await w.install();
    const res = await w.request('/events', { mode: 'navigate' });
    expect(await res!.text()).toContain('LIVE SHELL');
    const saved = await (await w.caches.open('sangha-shell-v2')).match('/');
    expect(await saved!.text()).toContain('LIVE SHELL');
  });

  it('shows the saved page, then the offline page, when there is no connection', async () => {
    const w = makeWorker(net);
    await w.install();
    await w.request('/', { mode: 'navigate' }); // visit once while online
    online = false;
    expect(await (await w.request('/events', { mode: 'navigate' }))!.text()).toContain('LIVE SHELL');
    await (await w.caches.open('sangha-shell-v2')).delete('/');
    expect(await (await w.request('/events', { mode: 'navigate' }))!.text()).toContain('OFFLINE PAGE');
  });

  it('serves public data from a saved copy offline, and an honest 503 when it was never saved', async () => {
    const w = makeWorker(net);
    await w.install();
    const live = await w.request('/api/events');
    expect(await live!.json()).toMatchObject({ live: true });
    online = false;
    const saved = await w.request('/api/events');
    expect(saved!.status).toBe(200);
    expect(await saved!.json()).toMatchObject({ live: true });
    const missing = await w.request('/api/blogs');
    expect(missing!.status).toBe(503);
    expect((await missing!.json()).error).toMatch(/offline/i);
  });

  it('falls back to the saved copy when the network is too slow', async () => {
    vi.useFakeTimers();
    const w = makeWorker(net);
    await w.install();
    await w.request('/api/events');
    net.impl = () => new Promise<Response>(() => undefined); // a connection that never answers
    const pending = w.request('/api/events');
    await vi.advanceTimersByTimeAsync(5001);
    expect((await pending)!.status).toBe(200);
  });

  it('keeps photos and build files after the first load (cache first)', async () => {
    const w = makeWorker(net);
    await w.install();
    await w.request('/uploads/a.jpg', { destination: 'image' });
    await w.request('/assets/index-Abc.js');
    const before = net.calls.length;
    await w.request('/uploads/a.jpg', { destination: 'image' });
    await w.request('/assets/index-Abc.js');
    expect(net.calls.length).toBe(before); // second time came from the cache
  });

  it('leaves login, admin, registering, paying and uploads entirely to the browser', async () => {
    const w = makeWorker(net);
    await w.install();
    for (const [p, method] of [['/api/admin/registrations', 'GET'], ['/api/auth/me', 'GET'], ['/api/registrations/KS-ABC123', 'GET'], ['/api/events/x/register', 'POST'], ['/api/upload', 'POST'], ['/api/contributions', 'POST']] as const) {
      expect(await w.request(p, { method }), `${method} ${p}`).toBeUndefined();
    }
    // …and nothing from them ended up stored.
    const everything = (await Promise.all([...w.caches.stores.values()].map((s) => s.keys()))).flat().map((k) => k.url);
    expect(everything.filter((u) => /\/api\/(admin|auth|registrations|upload|contributions)/.test(u))).toEqual([]);
  });

  it('does not save failed responses or ones marked no-store', async () => {
    const w = makeWorker(net);
    await w.install();
    const original = net.impl;
    net.impl = async () => new Response('boom', { status: 500 });
    await w.request('/api/events');
    net.impl = async () => new Response('{}', { status: 200, headers: { 'Cache-Control': 'no-store' } });
    await w.request('/api/blogs');
    net.impl = original;
    const api = await w.caches.open('sangha-api-v2');
    expect(api.entries.size).toBe(0);
  });

  it('caps how much it stores on a phone', async () => {
    const w = makeWorker(net);
    await w.install();
    for (let i = 0; i < 120; i++) await w.request(`/assets/chunk-${i}.js`);
    const assets = await w.caches.open('sangha-assets-v2');
    expect(assets.entries.size).toBeLessThanOrEqual(80);
    // The newest are kept.
    expect(assets.entries.has(`${ORIGIN}/assets/chunk-119.js`)).toBe(true);
    expect(assets.entries.has(`${ORIGIN}/assets/chunk-0.js`)).toBe(false);
  });

  it('cleans out old versions when it activates, and takes over only on the visitor\'s say-so', async () => {
    const w = makeWorker(net);
    await (await w.caches.open('sangha-api-v0')).put('/api/old', json({}));
    await w.install();
    await w.activate();
    expect(await w.caches.keys()).not.toContain('sangha-api-v0');
    expect(await w.caches.keys()).toContain('sangha-shell-v2');
    expect(w.claim).toHaveBeenCalled();
    await w.message({ type: 'SKIP_WAITING' });
    expect(w.skipWaiting).toHaveBeenCalledTimes(1);
    await w.message({ type: 'SOMETHING_ELSE' });
    expect(w.skipWaiting).toHaveBeenCalledTimes(1);
  });
});
