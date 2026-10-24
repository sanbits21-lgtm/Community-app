# Launch checklist

Use this together with `docs/DEPLOY.md` (real site on your own server) or `docs/DEMO-HOSTING.md` (free demo).
Tick each line. Nothing here needs code changes.

## 1. Before you deploy

- [ ] Project is in a **private** Git repository (`git status` shows no `.env`, no `node_modules`, no `uploads`).
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm build` all pass on your machine.
- [ ] You have: the domain, the server (or Render/Atlas accounts), and an email sending account if you want emails.
- [ ] `.env` on the server is filled in from `.env.production.example`: `DOMAIN`, `PUBLIC_URL`, `JWT_SECRET` (32+ random characters), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters, not an easy word).
- [ ] **`DEMO_MODE` is NOT set** on the real site (it adds a demo banner, sample data and a button that erases data).

## 2. Right after the first start

- [ ] `https://YOUR-DOMAIN/healthz` says `{"ok":true}` and the padlock is shown.
- [ ] Sign in at `/admin`, then **change nothing else until step 3**.
- [ ] A fresh real site starts **empty**: no sample events, board or sponsors. That is correct.

## 3. Fill in the site (Admin)

- [ ] **Site settings**: name, tagline, logo, about, contact details, social links, **Useful links**, **Colour theme**, page banners.
- [ ] **Payment options**: your real IBAN (checked for typos on save), account holder, **Wero QR** if you use it. Make a small test payment to yourself and compare the amount and reference in your bank app.
- [ ] **Home banners**, **Board members**, **Sponsors** (tick the events each sponsor supports), **Events**, **Our journey** (the menu link appears once the page has content).
- [ ] Delete anything called "Sample", and check the footer's Photo credits only lists photos you actually use.

## 4. Check like a visitor

- [ ] Open the site on a phone, in English and in Kannada, in light and dark mode.
- [ ] Register for a free event and for a paid event; confirm the payment screen shows the right IBAN and amount.
- [ ] Install it to the home screen (PWA) and open it with the phone in flight mode: the offline page and "My registrations" should open.
- [ ] If you set up email: register with your own address and check the confirmation arrives (and not in spam).

## 5. Keep it healthy

- [ ] Schedule `deploy/backup.sh` daily (cron) and copy the backups **off the server**. Practise `deploy/restore.sh` once.
- [ ] Watch disk space; uploaded photos and payment screenshots live in the `uploads` volume.
- [ ] Update the server and run `docker compose pull && docker compose up -d --build` now and then.
- [ ] Remember: payment screenshots of verified/rejected payments are deleted after 30 days, unused uploads after 7 days (see `.env.production.example`).

## Known limits (see `docs/QA-REPORT.md`)

Lists are not paginated, there is no CAPTCHA (a honeypot and rate limits are used instead), and there is no disk-full alert.
The PWA install icon and `offline.html` use the classic yellow/red; the colour theme chosen in the admin does not change them.
