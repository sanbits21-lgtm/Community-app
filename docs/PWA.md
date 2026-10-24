# The app on your phone (PWA)

The website can be installed on a phone like an app, opens fast, keeps working for pages already visited when
there is no signal, and remembers a visitor's registration codes. It needs **HTTPS** (your real domain, or
`localhost` while testing). The service worker only runs in the **production build**, not in `pnpm dev`.

## What it does

| Feature | Where it lives |
|---|---|
| Install ("Add to home screen") | `public/manifest.webmanifest`, `public/icons/*`, install card in `src/components/pwa.tsx` |
| Offline / saved pages | `public/sw.js` (the worker), `public/sw-rules.js` (which requests it may save), `public/offline.html` |
| "You're offline" bar | `OfflineBar` in `src/components/pwa.tsx` |
| Update prompt ("A new version is ready · Refresh") | `PwaBoot` in `src/components/pwa.tsx` |
| My registrations (codes saved on the phone) | `src/pages/My.tsx`, `src/lib/mine.ts`, route `/my` |

**Install card:** appears only after 3 visits, never inside the installed app, and not again for 30 days after
"Not now". On iPhone there is no install event, so it shows the "Share → Add to Home Screen" steps instead.

## What is saved for offline, and what never is

Saved (so pages open with no signal): the site's own files, fonts it has loaded, your uploaded photos, the home page,
events, blog, gallery, board and settings the visitor has already seen.

**Never saved, always live:** the admin screen and login, registering, paying, "I've paid", uploads, and the
registration status lookup. Offline, those show a clear message rather than pretending to work.

A phone may show slightly old event details for a few seconds until it reaches the network. Fresh data replaces it
whenever there is a connection.

## Changing the icon

The generated icon is a flag-coloured badge with "ಕ". To use your own logo, **replace these files** in
`apps/web/public/icons/` (keep the names and sizes exactly), then rebuild and redeploy:

| File | Size | Notes |
|---|---|---|
| `icon-192.png` | 192×192 | Standard icon |
| `icon-512.png` | 512×512 | Standard icon, also used for the splash screen |
| `maskable-512.png` | 512×512 | Android crops this into a circle/squircle: **keep the important part inside the centre 80%** and fill the whole square with a background colour |
| `apple-touch-icon.png` | 180×180 | iPhone home screen. Must have no transparent areas |
| `icon.svg` | any | Browser-tab icon |

`pnpm test` checks that every icon exists and is exactly the size the manifest says, so a wrong-sized file is caught.
Phones that already installed the app may keep the old icon until it is reinstalled.

Other things you can edit in `public/manifest.webmanifest`: the app `name`/`short_name`, `theme_color` (the status
bar colour) and the three home-screen shortcuts.

## Testing it for real

1. `pnpm build`, then run the production server (see `docs/DEPLOY.md`, or `NODE_ENV=production` with the usual
   settings) and open it over `localhost` or your HTTPS domain.
2. In Chrome: DevTools → **Application** → *Manifest* (installable?), *Service Workers* (activated?), then tick
   **Offline** under *Network* and reload: saved pages should still open.
3. Run a Lighthouse audit (DevTools → Lighthouse → Progressive Web App).
4. On a phone: visit the live site 3 times (or clear the "visits" counter) to see the install card.

## What has been tested automatically

`pnpm test` runs the real `sw.js` against a simulated browser cache and covers: saving the shell on install, live page
when online, saved page then offline page when offline, saved public data offline and an honest 503 for unsaved data,
fallback after a slow network, photos/build files cached after first load, login/admin/registering/uploading left
entirely to the network, failed or `no-store` responses never saved, cache size limits, clean-up of old versions, and
updates only taking over when the visitor taps Refresh.

**Not tested in a real browser:** the tool used during development cannot run service workers, so install, real
offline mode and the update prompt still need one pass on a real phone or in Chrome before launch (steps above).
