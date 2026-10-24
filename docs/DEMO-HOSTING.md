# Free demo hosting: Render + MongoDB Atlas

Goal: a link such as `https://kannada-sangha-demo.onrender.com` that your customer can open any time and explore.
Cost: **€0**. Time: about 45 minutes the first time. You need a GitHub account (free).

> This is for **showing** the site, not running it. The real site should use the setup in `docs/DEPLOY.md`.

## What you get, and the honest limits

- **Sample content** (events, board, blog, gallery) is restored automatically, and a black **"DEMO SITE"** bar shows on every page. The payment screen shows "**DEMO ONLY - do not pay**".
- **It goes to sleep after 15 minutes without visitors.** The next visit takes 30–60 seconds to wake it. **Open the link yourself a couple of minutes before the customer does.** ([Render free tier](https://render.com/docs/free))
- **Files are forgotten on restart.** The sample photos come back by themselves; photos or screenshots you upload while testing do not. That is fine for a demo.
- **The database is separate and keeps its data** (registrations made by the customer stay until you press **Reset demo data**).
- Free tiers change. Check the current limits on Render's and Atlas's own pages.

## 1. Put the project on GitHub (once)

1. On github.com create a **private** repository (for example `kannada-sangha`). Do not add a README.
2. In PowerShell, in the project folder (`C:\Users\santh\kannada-sangha`):

```powershell
git init -b main
```
```powershell
git add .
```
```powershell
git status
```
Check the list: there must be **no `.env` file**, no `node_modules`, no `uploads` folders (the `.gitignore` already excludes them).
```powershell
git commit -m "Kannada Sangha demo"
```
```powershell
git remote add origin https://github.com/YOUR-NAME/kannada-sangha.git
```
```powershell
git push -u origin main
```

## 2. Create the free database (MongoDB Atlas)

1. Sign up at mongodb.com/atlas. **Build a database → Free (M0)**.
2. Provider/region: pick an **EU** region if offered (for example Frankfurt). The [free tier](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) has 512 MB, plenty for a demo.
3. **Database user:** create one. Use a long password made of letters and numbers only (symbols must be URL-encoded in the connection string).
4. **Network access → Add IP address → Allow access from anywhere (`0.0.0.0/0`).** Render's free instances have no fixed address, so this is required. It is acceptable for a short demo because the database is protected by its long password; delete the cluster when you are done.
5. **Connect → Drivers** and copy the connection string. It looks like
   `mongodb+srv://USER:PASSWORD@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
   Replace `PASSWORD` with your real password and put the database name `sangha` before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.abcde.mongodb.net/sangha?retryWrites=true&w=majority`

## 3. Deploy on Render

1. Sign up at render.com **with your GitHub account** and allow it to see the repository.
2. **New → Blueprint** → choose your repository. Render reads `render.yaml` and shows one service, *kannada-sangha-demo* (Free).
3. It asks for three values:
   - `MONGODB_URI`: the string from step 2.5.
   - `ADMIN_EMAIL`: any address you like (it is only your sign-in name).
   - `ADMIN_PASSWORD`: **12 or more characters and not an easy word** (a few random words works well, e.g. `river-lantern-copper-47`). The app refuses to start otherwise. Keep it in your password manager.
4. **Apply**. The first build takes roughly 5–10 minutes. When it says **Live**, open the address at the top of the page.

If the Blueprint screen complains about a field, create the service by hand instead: **New → Web Service → your repo → Language: Docker → Instance type: Free**, then add the environment variables listed in `render.yaml` under *Environment*.

## 4. Check it (5 minutes)

- Open `https://YOUR-NAME.onrender.com/healthz`: it should say `{"ok":true}`.
- The home page shows the black **DEMO SITE** bar, a banner, events, board members.
- Register for the paid event: the payment screen shows a QR code and **DEMO ONLY - do not pay**.
- `/admin`: sign in with your email and password. The dashboard has a **Reset demo data** button.
- Open the site in Kannada (top right) and on your phone.

## 5. Showing the customer

- Send the plain link. Tell them the **first page may take up to a minute** if nobody has visited for a while.
- **Do not share the admin password** unless you want them to be able to change things. If you do, press **Reset demo data** afterwards.
- Anything they register while exploring is stored in the demo database: use it as part of the demo, then reset.
- *Optional, to avoid the sleep:* a free uptime monitor (for example UptimeRobot) pinging `/healthz` every 10 minutes keeps it awake. One always-on service fits inside Render's 750 free hours a month; check that this is still true on Render's pricing page.

## 6. When the demo is over

Delete the Render service and the Atlas cluster (and the Atlas database user), and keep the private GitHub repository. Nothing in the demo is real customer data, but do not leave unused services running with open network access.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Logs say *Refusing to start in production* | `ADMIN_PASSWORD` is under 12 characters or an easy word. Change it in *Environment* and redeploy. |
| Logs say *MongoServerSelectionError* or *authentication failed* | Wrong password in `MONGODB_URI`, symbols not URL-encoded, or Atlas *Network access* does not allow `0.0.0.0/0`. |
| Page takes a minute, then works | It was asleep (normal on the free plan). |
| Site works but no sample content | `DEMO_MODE` is not `true`, or the database already contained data. Sign in and press **Reset demo data**. |
| Build fails on Render | Open the build log; send me the last 30 lines. |

## Safety rules for demo mode

- `DEMO_MODE=true` is **only** for this demo. On a real site it would add a demo banner and a button that erases data.
- The IBAN in the sample data is a documentation example. It is labelled DEMO ONLY on purpose.
- The sample photos come from Wikimedia Commons: leave the *Photo credits* link in the footer.
