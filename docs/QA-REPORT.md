# QA & security report

> **Status: all High and Medium findings are fixed (see "Fix status" below).** The original findings follow for the record.

Scope: the whole application as it stands (API, website, admin, PWA files, Docker/deploy kit).
Method: code review, dependency audit, 70+ automated probes against a throwaway API + database, and a browser pass over
14 pages × 3 screen widths (320 / 768 / 1280 px). Nothing in your development data was changed.

**How to re-run:** `pnpm test`. The probes live in `apps/api/test/qa-probe.test.ts`. Tests written as `it.fails(...)` are
confirmed, unfixed defects (suite stays green); when you fix one, vitest says "expected to fail but passed": change it to
`it` and it becomes a permanent guard.

## Fix status

Fixed on 24 October 2026. Re-tested with the automated suite (**90 tests, all passing**, run twice) and, for the security
fixes, against a real production-mode copy of the server with its own database, driven through the browser and over real HTTP.

| ID | Issue | Status | How it was verified |
|---|---|---|---|
| F-01 | Overbooking | **Fixed** | Seats are taken with one atomic update. 12 simultaneous HTTP requests for 1 seat: exactly 1 accepted, 11 told "full" (before: 13 of 15 got in). Reject/restore/delete keep the counter right; a repair job runs at start-up. |
| F-02 | Removed/demoted admins and signed-out tokens stayed valid | **Fixed** | Every admin request now checks the account, its role and its session. Deleted admin, demoted owner, signed-out cookie (even a copied one) and old-format tokens are all refused; changing the password signs out every other device. |
| F-03 | Vulnerable `multer` / `body-parser` | **Fixed** | Updated to multer 2.5.0 and body-parser 2.4.0. `pnpm audit --prod`: no known vulnerabilities. |
| F-04 | Public upload could fill the disk | **Fixed** | Public upload: 1 file, 5 MB, 8 per 10 minutes. A daily job deletes unused photos and unattached screenshots after 7 days. Tested, including that a screenshot uploaded a minute ago is kept. *Not done:* a disk-space alert (monitor the server's disk). |
| F-05 | Login timing revealed admin emails | **Fixed** | Real bcrypt comparison for unknown emails; timing test passes. |
| F-06 | 500 errors for bad/oversized requests | **Fixed** | Malformed JSON → 400, oversized → 413. |
| F-07 | Unlimited registration-code guessing | **Fixed** | 30 lookups per 10 minutes per visitor. |
| F-08 | Stale IBAN could be shown from the offline cache | **Fixed** | Payment details are never cached; old saved copies are deleted when the new worker activates. |
| F-09 | Registration form could email strangers | **Mostly fixed** | Max 3 emails per address and 40 per visitor per day, plus a hidden honeypot field for bots. *Not done:* a CAPTCHA; the counters are in memory (reset when the server restarts; right for one server). |
| F-10 | Weak passwords and secrets | **Fixed** | Admin passwords need 12+ characters and no easy words; production refuses to start with a `JWT_SECRET` under 32 characters or a weak `ADMIN_PASSWORD` (4 start-up tests). New **Admin → My account** screen to change your password. |
| F-11 | Payment screenshots publicly reachable | **Fixed** | Stored in a private folder; only signed-in admins can open them (checked in the browser: admin 200, visitor 401, never cached). A proof must be one of our own files, not a typed address. Settled payments' screenshots are deleted after 30 days. |
| F-12 | `javascript:` links accepted | **Fixed** | Links must be `https://` (or a page on this site); images likewise. |
| F-13 | Validation gaps | **Fixed** | Bad ticket numbers refused; a paid event needs a priced ticket (and old data without one is refused at the door); an event cannot end before it starts. |
| F-14 | Admin time zone mismatch | **Fixed** | The admin date picker reads and writes Luxembourg time and says so. Checked in a browser set to India time: the picker showed 03:00 (Luxembourg), not 07:30. DST edge cases tested. |
| F-15 | Credits/Contribute overflow at 320 px | **Fixed** | No sideways scrolling on any of 14 pages at 320 px and 1280 px. |
| F-16 | Keyboard trap in the home banner | **Fixed** | Hidden slides are `inert`; zero focusable controls inside hidden content. |
| F-17 | Same title everywhere, no home heading | **Fixed** | Every page has its own title; every page has exactly one main heading; unknown addresses return HTTP 404 and are not indexed; focus moves to the new page on navigation. |
| F-18 | Small tap targets | **Partly fixed** | Footer, contact and credits links and checkboxes enlarged. Many buttons are still under the 44 px comfort size (all are over the 24 px WCAG minimum). |
| F-19 | No pagination | **Not done** | Fine for hundreds of items; revisit when registrations reach the thousands. |
| F-20 | One big JavaScript file | **Fixed** | The admin screens (39 KB) now download only for `/admin`; the public bundle dropped from 516 KB to 493 KB. |
| F-21 | Deleted photos stay on disk | **Fixed** | Covered by the daily clean-up (F-04). |

### Things that change for you
- **Everyone signs in again once**, because the sign-in cookie format changed.
- **Production passwords/secrets are checked** (see F-10). Existing weak ones must be replaced before deploying.
- **Docker volume layout:** the volume now mounts at `/data` and holds both `uploads` (public photos) and `private` (payment screenshots). Back-ups already cover the whole volume. Nothing to migrate: nothing has been deployed yet.
- **Tests:** `apps/api/test/qa-probe.test.ts` is now a permanent regression suite for everything above (no known defects remain marked as expected failures).

### Found while fixing (not in the original report)
- A first version of the screenshot clean-up would have deleted a screenshot someone had just uploaded but not yet submitted. A test caught it before it shipped.
- The new tests were writing into the app's real folders; they now use temporary ones.

## Original findings

## Summary

| Severity | Count | Meaning |
|---|---|---|
| High | 4 | Fix before real users |
| Medium | 9 | Fix soon after launch |
| Low | 5 | Polish / watch |

Evidence tags: **[proved]** reproduced by an automated probe or measurement · **[audit]** from `pnpm audit` · **[code]** by reading the code (not reproduced).

## High

**F-01 Overbooking: more seats can be sold than the event has** [proved]
A capacity-1 event accepted **13** registrations when 15 people clicked at once (13 seats booked). The capacity check and
the save are two separate steps, so simultaneous requests all pass the check.
*Fix:* do the check-and-insert atomically (a single `findOneAndUpdate` on a seat counter, or a transaction; Mongo needs a replica set for transactions, so a counter document is simpler). *Effort: ~½ day.*

**F-02 A removed or demoted admin keeps full access for up to 7 days** [proved]
Sign-in tokens last 7 days and are never checked against the database. Deleting an admin, demoting an owner, or the admin
pressing "Sign out" does not stop an already-issued token (a stolen laptop/phone stays a working admin).
*Fix:* on each admin request load the account (and reject if missing/disabled; use the role stored in the database, not the one in the token). Add a `tokenVersion` to revoke on password change/sign-out-everywhere. *Effort: ~½ day.*

**F-03 Two known-vulnerable dependencies** [audit]
`multer` (< 2.5.0, you have 2.4.x) and `express`'s `body-parser` (< 2.4.0): both "high" denial-of-service advisories.
*Fix:* `pnpm update multer express` (and reinstall); re-run `pnpm audit --prod`. *Effort: minutes.*

**F-04 Anyone can fill the server's disk through the public upload** [proved]
The public screenshot endpoint (`POST /api/upload`) accepted **20 files in one request** (up to 6 MB each) and the rate limit
counts requests, not files. Uploads are never cleaned up, even when a registration is abandoned.
*Fix:* public upload = exactly 1 file, 2 MB, images only; count files in the limiter; delete uploads not referenced after N days; set a disk-usage alert. *Effort: ~½ day.*

## Medium

**F-05 Sign-in reveals which emails are admin accounts** [proved]
A wrong password for a real account takes ~67 ms; for an unknown email ~3 ms. *Fix:* always do a real bcrypt comparison against a valid dummy hash. *Effort: minutes.*

**F-06 Bad requests cause server errors (500) instead of 400/413** [proved]
Malformed JSON and an oversized body return `500 Something went wrong` (and log a stack trace). Harmless to data, but it hides real errors, breaks API clients' expectations and is noisy in logs. *Fix:* honour `err.status` in the error handler. *Effort: minutes.*

**F-07 Registration codes can be guessed without limit** [proved]
`GET /api/registrations/:code` has no rate limit (150 rapid tries, no 429). Codes are ~30 bits; a hit reveals the attendee's name, event and amount (not phone/email). *Fix:* rate limit lookups (e.g. 20 per 10 min per IP); optionally lengthen the code. *Effort: minutes.*

**F-08 The offline cache can hold stale payment details** [proved]
The service worker caches `/api/payment` (IBAN). On a slow connection (>5 s) it falls back to the saved copy, so after you change your IBAN someone could still be shown the old account and QR. *Fix:* remove `payment` from the cached endpoints in `public/sw-rules.js`. *Effort: minutes.*

**F-09 The registration form can be used to send email to strangers** [code]
Anyone can register with any email address and we send a message to it. Limit is 30 registrations per 10 minutes per IP (≈4,300/day per IP), which can damage your sending reputation or get the domain flagged as spam. *Fix:* per-address and per-IP daily caps, a CAPTCHA/honeypot on the form, and consider emailing only after the first verified payment. *Effort: ~½ day.*

**F-10 Weak passwords and secrets are accepted** [proved / code]
An admin can be created with the password `aaaaaaaa`. In production the app only checks that `JWT_SECRET` and `ADMIN_PASSWORD` are *set*, so `JWT_SECRET=a` starts fine (anyone could then forge admin tokens). *Fix:* require ≥12 chars (and reject common passwords); in production refuse `JWT_SECRET` < 32 chars and `ADMIN_PASSWORD` < 12. There is also no "change my password" screen. *Effort: ~½ day.*

**F-11 Payment screenshots are public to anyone with the link** [code]
Screenshots are stored with gallery photos under `/uploads/…`, served without sign-in. The names are random (not guessable) but they are permanent and can contain bank details. For GDPR, treat them as private. *Fix:* store them separately and serve only to signed-in admins; delete after the payment is verified. *Effort: ~½ day.*

**F-12 Site links accept `javascript:` addresses** [proved]
Social links (and similar fields) save any text. In production the Content-Security-Policy blocks `javascript:` links from running, so exploitability is low, but a compromised admin account should not be able to plant a malicious link. *Fix:* accept only `http(s)://` (and `mailto:` where relevant). *Effort: minutes.*

**F-13 Validation gaps in registrations and events** [proved]
- A ticket number outside the list (`ticketIndex: 7`) is silently priced as ticket 0.
- A paid event with no ticket types accepts registrations as "pending, €0".
- An event can end before it starts (breaks the calendar file and countdown).
*Fix:* reject these with clear messages. *Effort: minutes.*

**F-14 Event times: entered in the admin's time zone, shown in Luxembourg time** [code + observed earlier]
The admin date picker uses the admin's browser time zone; the public site always shows Luxembourg time. An admin outside Luxembourg (or with a wrong PC clock) will publish the wrong time without any warning. *Fix:* interpret the picker in `Europe/Luxembourg` and show "Luxembourg time" next to it. *Effort: ~½ day.*

**F-15 The Photo credits page is unusable on a small phone** [proved]
At 320 px wide the page is 791 px wide (sideways scrolling) because the credit cards can't shrink. The Contribute progress bar overflows by 6 px at 320 px. *Fix:* `min-w-0` on the cards and shorter step labels. *Effort: minutes.*

**F-16 Keyboard and screen-reader trap in the home banner** [proved]
Hidden slides are marked `aria-hidden` but their buttons ("Know more", "Contribute") can still be tabbed to. *Fix:* use the `inert` attribute on non-active slides. *Effort: minutes.*

## Low

**F-17 Every page has the same title; the home page has no main heading** [proved]
All 14 pages are titled "Kannada Sangha" (bad for tabs, history, screen readers and search); the home page has no `h1` (banner titles are `h2`); unknown URLs show a 404 message but return HTTP 200. *Fix:* set `document.title` per page, make the first banner or a hidden heading the `h1`. *Effort: ~2 h.*

**F-18 Small tap targets** [proved]
Footer text links (My registrations, phone, email, Photo credits) are only 17–19 px tall, under the WCAG 2.2 AA minimum of 24 px; many controls are under the 44 px recommended for thumbs (e.g. the language switch). *Fix:* more padding on links, `min-h-11` on controls.

**F-19 Lists are not paginated** [code]
Admin and public lists load everything. Fine for hundreds of items; plan pagination if registrations reach thousands.

**F-20 One large JavaScript file (516 KB, 154 KB compressed) includes the admin screens for every visitor** [measured]
*Fix:* load the admin code only for `/admin` (route-level code splitting).

**F-21 Uploaded photos are never deleted** [code]
Deleting a banner or album leaves its image files on disk. Combine with F-04's clean-up job.

## Passed (nothing found)

- **Access control:** all 28 admin endpoints refuse anonymous callers; forged tokens (wrong key, `alg: none`, garbage) rejected; a plain admin cannot manage admins or create owners.
- **Injection:** NoSQL operators in login and query strings are neutralised; no `dangerouslySetInnerHTML`, `eval` or raw HTML anywhere; React escapes all user text.
- **Price integrity:** the server calculates the amount; a client-sent `amount` or `status` is ignored.
- **Input validation:** zero/negative/huge/decimal attendee counts, short/long names, bad phone/email (including `a@b.co,c@d.co`) all rejected.
- **Uploads:** SVG, HTML disguised as PNG, 7 MB files, 21 files and `../../` file names all refused; files are served as images with `nosniff`; path traversal on `/uploads` blocked.
- **Exports:** CSV formula injection neutralised.
- **Hidden content:** unpublished events can't be viewed or registered for; invalid ids return 400/404, not 500.
- **Headers/cookies:** CSP, `X-Frame-Options`, `nosniff`, no `X-Powered-By`, no CORS; login cookie `HttpOnly` + `Secure` + `SameSite=Lax` in production.
- **Sign-in brute force:** limited to 20 per 15 minutes per visitor, and visitors behind the proxy are told apart correctly (rehearsal).
- **Accessibility basics:** no images without `alt`, no unlabeled form fields, no nameless buttons/links, no duplicate ids; text colours pass WCAG AA in both themes.
- **Responsive:** no sideways scrolling on 12 of 14 pages at 320 px, and none at 768/1280 px.

## Not tested (needs a real environment)

- Real browser behaviour of the service worker (install, true offline, update prompt): the development browser cannot run service workers. The worker's logic *is* unit-tested (`pwa-worker.test.ts`).
- iPhone/Safari ("Add to Home Screen" card), Android install, Lighthouse score.
- The Docker image, Caddy HTTPS and the backup/restore scripts (no Docker engine on this PC).
- Real email delivery (needs your SMTP login), real Wero QR, and a real banking app scanning the EPC QR.
- Load/performance under many simultaneous visitors, and penetration testing of the live server (TLS, firewall, SSH).
- Payment reconciliation process (human step).

## Suggested order of work

1. **Minutes each (do first):** F-03 update packages, F-05 timing, F-06 error codes, F-07 lookup limit, F-08 payment not cached, F-12 link check, F-13 validation, F-15 overflow, F-16 `inert`.
2. **Half-day each:** F-01 overbooking, F-02 token checks, F-04 upload limits + clean-up, F-10 password/secret rules, F-11 private screenshots, F-14 time zone, F-09 email abuse.
3. **Later:** F-17 titles/headings, F-18 touch targets, F-19–F-21.
