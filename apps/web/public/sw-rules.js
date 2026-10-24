/* Which requests the service worker may answer from its cache, and how.
 *
 * Kept separate from sw.js and free of any browser APIs except URL, so the rules can be unit-tested in Node
 * (apps/api/test/pwa.test.ts). The golden rule: anything personal, authenticated or state-changing is
 * 'bypass' and always goes to the network.
 */
(function (root) {
  // Public read-only API endpoints that are safe to show from a saved copy when offline.
  var PUBLIC_API = [
    /^\/api\/(home|settings|board|credits)$/, // NOT payment: bank details must always be live
    /^\/api\/(events|blogs|gallery)(\/[^/]+)?$/,
  ];

  /**
   * @param {{ url: string, method: string, mode?: string, destination?: string, origin: string }} req
   * @returns {'bypass'|'shell'|'cache-first-immutable'|'cache-first-image'|'network-first-api'|'stale-while-revalidate'}
   */
  function strategyFor(req) {
    if (req.method !== 'GET') return 'bypass';
    var u = new URL(req.url);
    if (u.origin !== req.origin) return 'bypass';
    var p = u.pathname;

    if (p.indexOf('/api/') === 0) {
      return PUBLIC_API.some(function (re) { return re.test(p); }) ? 'network-first-api' : 'bypass';
    }
    if (p === '/healthz' || p === '/sw.js' || p === '/sw-rules.js') return 'bypass';

    // Photos are cached only when a page asks for them as images. Opening an upload directly (an admin
    // looking at a payment screenshot) is a document request and is never stored.
    if (p.indexOf('/uploads/') === 0) return req.destination === 'image' ? 'cache-first-image' : 'bypass';

    // Build output has the content hash in its file name, so a cached copy can never be stale.
    if (p.indexOf('/assets/') === 0) return 'cache-first-immutable';

    if (p.indexOf('/icons/') === 0 || p === '/theme-init.js' || p === '/manifest.webmanifest') return 'stale-while-revalidate';

    if (req.mode === 'navigate') return 'shell';
    return 'bypass';
  }

  root.SANGHA_SW_RULES = { strategyFor: strategyFor };
})(typeof self !== 'undefined' ? self : this);
