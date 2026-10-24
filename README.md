# ಕನ್ನಡ ಸಂಘ — Kannada Sangha community app

MERN app for a Kannada community association: public site (bilingual ಕನ್ನಡ/English) plus an admin screen.

## Run it

```bash
pnpm install
pnpm dev          # API on :4000, web on :5173
```

No Docker or Atlas needed in development: with `MONGODB_URI` empty the API starts a local MongoDB
(data in `apps/api/.data`) and seeds sample content on first boot.

- Site: http://localhost:5173
- Admin: http://localhost:5173/admin — sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (see `.env.example`).
  **Change the password before deploying** (Admins → add yourself, then remove the default).

## What the admin can manage

Banners (image, text, button, schedule, drag-to-reorder, live preview) · Notifications (pin/expire) · Board members ·
Events (paid/free, ticket types, capacity) · Registrations (verify/reject, CSV) · Contributions ·
Blog · Gallery albums · **Payment options (IBAN for the SEPA QR, Wero)** · Site settings · Admin users.

The **first** board member in the list is featured large on the home page; the rest scroll below.

## How payment works (Luxembourg / euro)

No payment gateway, and no fees. Amounts are in EUR.

1. The attendee registers (or contributes) and gets a code such as `KS-6M9PHD`.
2. The next screen shows a **SEPA (EPC) QR code** built from the admin's IBAN, with the exact amount and the code as the payment reference. Any euro-area banking app can scan it and pre-fill the transfer. The IBAN, BIC, amount and reference are also shown as text with copy buttons.
3. If configured, a **Wero** section shows the sangha's Wero QR image and/or phone number. A static Wero QR does not carry the amount, so payers are asked to put the code in the message.
4. The payer taps *I've made the payment* (optionally adding a confirmation number or screenshot). The registration stays *pending*.
5. The admin matches the code on the bank statement and clicks **Verify** (or **Reject**). Free events confirm instantly. Seats are held while pending and released on Reject.

Set it up in **Admin > Payment options**: account holder, IBAN (checksum-validated on save), optional BIC, and the optional Wero QR/handle. The seeded IBAN is a documentation placeholder; replace it before going live.

## Installable app (PWA)

The site can be installed on phones and keeps working for visited pages offline. How it works, how to swap the icon, and how to test it: `docs/PWA.md`.

## Quality and security

See `docs/QA-REPORT.md` for the full test and security review, what was found, and how each fix was verified. Admin passwords need 12+ characters; admins can change theirs under **Admin → My account**. In production the app refuses to start with a weak `JWT_SECRET` or `ADMIN_PASSWORD`.

## Free demo for a customer

To show the site to a customer for free (Render + MongoDB Atlas), follow `docs/DEMO-HOSTING.md`. It uses `render.yaml` and the `DEMO_MODE` setting, which must never be used on a real site.

## Optional email confirmations

Set `SMTP_URL` (and `MAIL_FROM`, `PUBLIC_URL`) in `.env` and attendees who give an email get their payment details when they register, and a confirmation when you click **Verify**. Without `SMTP_URL` nothing is sent and everything else works the same. Email failures never block a registration.

## Notes for hosting in Luxembourg

- Event times are always shown in `Europe/Luxembourg` time (`EVENT_TZ` in `apps/web/src/lib/i18n.tsx`), whatever the visitor's own time zone is. The admin date pickers use the admin's browser time zone.
- Payments are EUR with a SEPA (EPC) QR code; see "How payment works" above.

## Deploy (single process)

```bash
pnpm build        # builds apps/web/dist
NODE_ENV=production pnpm start
```

The API serves the built site. Set `MONGODB_URI`, `JWT_SECRET`, `ADMIN_PASSWORD`, and point
`UPLOAD_DIR` at a **persistent** disk — uploaded photos live on local disk, so on hosts with
ephemeral filesystems (Render free, Heroku) they vanish on redeploy. Swapping `src/uploads.ts` for
Cloudinary/S3 is the one change needed there.

## Layout

```
apps/api         Express 5 + Mongoose · auth, admin CRUD, public API, uploads
apps/web         React + Vite + Tailwind · public site and /admin
packages/shared  Zod schemas used by both sides
```

`pnpm typecheck` and `pnpm test` (API tests run against a real in-memory MongoDB).
