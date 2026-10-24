# Deploying to a small server (about €5–7 a month)

One Hetzner Cloud server runs everything in Docker: the app, MongoDB, and Caddy (automatic HTTPS).
Photos and the database live in Docker volumes on the server's own disk.

## 0. What you need
- Your domain name and access to its DNS settings.
- A Hetzner Cloud account. Pick a small server (2 vCPU / 4 GB is plenty), **Ubuntu 24.04**, a **Germany or Finland** location (EU), and add your SSH key.
- Check the current price on hetzner.com/cloud before ordering; it has changed several times this year.

## 1. Point the domain at the server
In your domain's DNS, add an **A** record: `yoursangha.lu` → the server's IPv4 address (and an **AAAA** record for the IPv6 address if you like). Wait a few minutes. `www` is optional (see `deploy/Caddyfile`).

## 2. Prepare the server (once)
```bash
ssh root@YOUR_SERVER_IP

apt-get update && apt-get -y upgrade
curl -fsSL https://get.docker.com | sh            # installs Docker + the compose plugin
apt-get -y install ufw unattended-upgrades git
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw allow 443/udp && ufw --force enable
dpkg-reconfigure -plow unattended-upgrades        # automatic security updates: answer Yes
```
Optional but wise: create a non-root user, and disable SSH password login.
(MongoDB is **not** published to the internet; only Caddy's ports 80/443 are.)

## 3. Get the code onto the server
Easiest: put the project in a **private** Git repository and clone it:
```bash
git clone https://github.com/YOU/kannada-sangha.git /opt/sangha && cd /opt/sangha
```
No Git? Copy the folder from your PC instead (excluding `node_modules`):
```bash
rsync -av --exclude node_modules --exclude .data --exclude uploads --exclude dist ./ root@YOUR_SERVER_IP:/opt/sangha/
```

## 4. Configure
```bash
cd /opt/sangha
cp .env.production.example .env
nano .env        # set DOMAIN, PUBLIC_URL, JWT_SECRET (openssl rand -hex 48), ADMIN_EMAIL, ADMIN_PASSWORD
chmod 600 .env
```
The app **refuses to start** if `JWT_SECRET` is shorter than 32 characters or `ADMIN_PASSWORD` is weak (under 12 characters, or an easy word like "ChangeMe123!"). This is deliberate: a short secret would let anyone forge admin sign-ins.

## 5. Start it
```bash
docker compose up -d --build
docker compose ps                 # all three should be "running"/"healthy"
docker compose logs -f app        # Ctrl+C to leave
```
Open `https://yoursangha.lu`. The first visit may take a few seconds while Caddy gets the certificate.
Sign in at `/admin` with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then:
1. **Payment options:** your IBAN (checked for typos), account holder, optional Wero.
2. **Site settings:** name, logo, contact, social links, the home-page numbers and story.
3. Add banners, board members and your first event. A fresh server starts **empty** (no sample content).

## 6. Email (optional, free)
1. Create a free **Brevo** account (300 emails/day), add your domain, and add the DNS records it asks for (SPF/DKIM) so mail isn't marked as spam.
2. Create an SMTP key and put it in `.env`:
   `SMTP_URL=smtp://LOGIN:KEY@smtp-relay.brevo.com:587` and `MAIL_FROM=Kannada Sangha <hello@yoursangha.lu>`
3. `docker compose up -d` to apply. Register for a test event with your own email to check.

## 7. Backups (do this on day one)
```bash
chmod +x deploy/*.sh
sudo ./deploy/backup.sh                                  # try it once by hand
( crontab -l 2>/dev/null; echo '30 3 * * * /opt/sangha/deploy/backup.sh >> /var/log/sangha-backup.log 2>&1' ) | crontab -
```
This keeps 14 days in `/var/backups/sangha`. **A backup on the same server is not enough** if the server is lost:
- copy them off the server too (`rclone` to a Hetzner Storage Box / any cloud storage: set `RCLONE_REMOTE`), or
- turn on Hetzner's paid server backups/snapshots.

Restore (replaces everything): `./deploy/restore.sh /var/backups/sangha/db-…archive.gz /var/backups/sangha/uploads-…tgz`.
**Test a restore once on a spare server** so you know it works before you need it.

## 8. Updating the site later
```bash
cd /opt/sangha && git pull && docker compose up -d --build
```
Data is in volumes, so it survives rebuilds. Run a backup before big updates.

## Photos, payment screenshots and clean-up
- Two kinds of file live in the `/data` volume. **Website photos** (`/data/uploads`) are public. **Payment screenshots** (`/data/private`) are private: only a signed-in admin can open them, and visitors can attach one per payment.
- The app tidies up daily. Files nothing uses (a deleted banner's photo, a screenshot nobody submitted) are deleted after 7 days, and screenshots of payments you have verified or rejected are deleted after 30 days. Change these with `UPLOAD_GRACE_DAYS` and `PROOF_RETENTION_DAYS` in `.env`.
- Back-ups (`deploy/backup.sh`) include both folders. Watch the disk: `docker system df` and `df -h`.

## Privacy (GDPR) checklist
- The server is in the EU. Registrations hold names, phones and emails: say so in a short privacy notice and say who to contact.
- Delete old registrations you no longer need (Admin → Registrations). Payment screenshots are removed automatically (see above).
- Admins can change their own password under **Admin → My account**; this signs out every other device. Signing out ends that session for good.
- Keep `.env` private and the admin password strong. Remove any admin who leaves the committee.

## Troubleshooting
- **Site not loading / certificate error:** DNS must already point at the server, and ports 80/443 must be open (`ufw status`). `docker compose logs caddy`.
- **App restarts in a loop:** `docker compose logs app`; a missing `JWT_SECRET` or `ADMIN_PASSWORD` makes it refuse to start.
- **Disk filling up:** `docker system df`; `docker image prune -f` removes old build layers.
