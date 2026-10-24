/* Kannada Sangha service worker (hand-written, no dependencies).
 *
 *  - Pages:   network first, so visitors always get the latest site; a saved copy is shown when offline.
 *  - Build files and photos: cache first (their names change when their content does).
 *  - Public data (events, blog, gallery...): network first with a short timeout, saved copy as fallback.
 *  - Everything personal or state-changing (login, admin, registering, paying, uploads): never touched.
 *
 * Bump VERSION only to force every device to discard its saved copies.
 */
importScripts('/sw-rules.js');

var VERSION = 'v2'; // v2: payment details are no longer saved; activating this deletes any old saved copy
var CACHES = {
  shell: 'sangha-shell-' + VERSION,
  assets: 'sangha-assets-' + VERSION,
  images: 'sangha-images-' + VERSION,
  api: 'sangha-api-' + VERSION,
  static: 'sangha-static-' + VERSION,
};
var LIMITS = { shell: Infinity, assets: 80, images: 120, api: 60, static: 30 };
var PRECACHE = ['/', '/offline.html', '/manifest.webmanifest', '/theme-init.js', '/icons/icon-192.png', '/icons/icon-512.png'];
var NETWORK_TIMEOUT_MS = 5000;

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHES.shell).then(function (c) {
      return c.addAll(PRECACHE);
    }),
  );
  // No skipWaiting here: a new worker waits until the visitor taps "Refresh", so a page is never swapped mid-use.
});

self.addEventListener('activate', function (event) {
  var keep = Object.keys(CACHES).map(function (k) { return CACHES[k]; });
  event.waitUntil(
    caches
      .keys()
      .then(function (names) {
        return Promise.all(names.filter(function (n) { return keep.indexOf(n) === -1; }).map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); }),
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function withTimeout(promise, ms) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
    promise.then(
      function (v) { clearTimeout(t); resolve(v); },
      function (e) { clearTimeout(t); reject(e); },
    );
  });
}

function cacheable(response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return false;
  var cc = response.headers.get('Cache-Control') || '';
  return cc.indexOf('no-store') === -1;
}

function trim(cacheName, max) {
  return caches.open(cacheName).then(function (cache) {
    return cache.keys().then(function (keys) {
      // Oldest entries first; a cache never grows without bound on someone's phone.
      return Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map(function (k) { return cache.delete(k); }));
    });
  });
}

function store(cacheName, key, response, max) {
  var copy = response.clone();
  return caches.open(cacheName).then(function (cache) { return cache.put(key, copy); }).then(function () { return trim(cacheName, max); });
}

function shell(event, request) {
  return withTimeout(fetch(request), NETWORK_TIMEOUT_MS)
    .then(function (response) {
      // Every page is the same single-page app, so one saved copy of "/" serves them all offline.
      var type = response.headers.get('Content-Type') || '';
      if (cacheable(response) && type.indexOf('text/html') !== -1) event.waitUntil(store(CACHES.shell, '/', response, LIMITS.shell));
      return response;
    })
    .catch(function () {
      return caches.match('/').then(function (hit) { return hit || caches.match('/offline.html'); });
    });
}

function cacheFirst(event, request, cacheName, max) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (response) {
        if (cacheable(response)) event.waitUntil(store(cacheName, request, response, max));
        return response;
      });
    });
  });
}

function networkFirstApi(event, request) {
  return withTimeout(fetch(request), NETWORK_TIMEOUT_MS)
    .then(function (response) {
      if (cacheable(response)) event.waitUntil(store(CACHES.api, request, response, LIMITS.api));
      return response;
    })
    .catch(function () {
      return caches.open(CACHES.api).then(function (cache) {
        return cache.match(request).then(function (hit) {
          if (hit) return hit;
          return new Response(JSON.stringify({ error: 'You are offline and this page has not been saved yet.' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        });
      });
    });
}

function staleWhileRevalidate(event, request) {
  return caches.open(CACHES.static).then(function (cache) {
    return cache.match(request).then(function (hit) {
      var refresh = fetch(request)
        .then(function (response) {
          if (cacheable(response)) event.waitUntil(store(CACHES.static, request, response, LIMITS.static));
          return response;
        })
        .catch(function () { return hit; });
      return hit || refresh;
    });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var strategy = self.SANGHA_SW_RULES.strategyFor({
    url: request.url,
    method: request.method,
    mode: request.mode,
    destination: request.destination,
    origin: self.location.origin,
  });
  if (strategy === 'bypass') return; // the browser handles it as if there were no service worker

  if (strategy === 'shell') event.respondWith(shell(event, request));
  else if (strategy === 'cache-first-immutable') event.respondWith(cacheFirst(event, request, CACHES.assets, LIMITS.assets));
  else if (strategy === 'cache-first-image') event.respondWith(cacheFirst(event, request, CACHES.images, LIMITS.images));
  else if (strategy === 'network-first-api') event.respondWith(networkFirstApi(event, request));
  else if (strategy === 'stale-while-revalidate') event.respondWith(staleWhileRevalidate(event, request));
});
