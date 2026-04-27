# Deployment Guide

Hotel TimeTrack runs as a single Node.js process and stores its data as JSON
files on disk. To put it online for your team, you need two things:

1. A host that runs `npm start` (Render, Railway, Fly.io, a VPS, etc.).
2. A **persistent disk / volume**, because Render's and Railway's default
   filesystems are wiped on every deploy — without persistence you would lose
   every user, shift, and correction the next time the app restarts.

This guide covers the two most common options: **Render** (recommended, has a
free plan with persistent disks on the Starter tier) and **Railway**.

---

## 0. One-time prep (do this first)

Run these locally before pushing to GitHub.

```bash
cd /Users/topboy/hotel-timetrack

# 1. Initialise git (skip if you already have a repo)
git init
git add .
git commit -m "Initial commit"

# 2. Push to GitHub (create an empty repo first at github.com/new)
git remote add origin https://github.com/<your-user>/hotel-timetrack.git
git branch -M main
git push -u origin main
```

> **Note:** the repo includes the current `data/*.json` files (9 real users,
> 1 shift). They will be uploaded to the persistent disk in step 4 below so
> nothing is lost.

Generate a JWT secret you will need in step 2:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the output — you will paste it into the host's environment variables.

---

## Option A — Render (recommended)

### 1. Create the service

1. Go to [dashboard.render.com](https://dashboard.render.com) and click
   **New → Blueprint**.
2. Connect your GitHub account and select the `hotel-timetrack` repo.
3. Render will detect `render.yaml` and show one web service +
   one disk. Click **Apply**.

### 2. Fill in the secrets

When prompted (or in **Environment** afterwards), set:

| Variable         | Value                                                                |
| ---------------- | -------------------------------------------------------------------- |
| `JWT_SECRET`     | already filled in (Render generated it). Leave it.                   |
| `ADMIN_EMAIL`    | the email you want to use to log in as admin (e.g. your work email). |
| `ADMIN_PASSWORD` | a strong password — only used the first time the DB is empty.        |

`NODE_ENV`, `DATA_DIR`, and the disk are configured automatically by
`render.yaml`.

### 3. First deploy

Click **Deploy**. The first build takes 1–2 minutes. When the log shows:

```
Hotel Staff Time Tracker
URL:     http://localhost:10000
Data:    /var/data
```

…the app is live at the URL Render shows at the top of the page
(`https://hotel-timetrack.onrender.com` or similar).

> On the very first boot, because `/var/data/users.json` is empty,
> the server creates one admin account from `ADMIN_EMAIL` /
> `ADMIN_PASSWORD`. Sign in, then change the password from **My Account**.

### 4. Migrate the existing users & shifts (optional but recommended)

If you want the 9 real accounts and the existing shift to come along instead
of starting from scratch:

1. In the Render dashboard, open the service → **Shell** tab.
2. Upload your local data files (one of two ways):

   **Way 1 — paste each file** (simplest, works for small JSON):

   ```bash
   # In Render Shell:
   cat > /var/data/users.json <<'EOF'
   ...paste contents of your local data/users.json here...
   EOF

   cat > /var/data/hotels.json <<'EOF'
   ...paste contents of your local data/hotels.json...
   EOF

   cat > /var/data/shifts.json <<'EOF'
   ...paste contents of your local data/shifts.json...
   EOF

   cat > /var/data/corrections.json <<'EOF'
   ...paste contents of your local data/corrections.json...
   EOF
   ```

   **Way 2 — use the Render Disk via SCP** (advanced, see Render docs).

3. Restart the service from the dashboard. Your existing users and shifts
   are now live online.

### 5. Custom domain (optional)

In the service → **Settings → Custom Domains**, add your domain (e.g.
`timetrack.yourcompany.com`). Render walks you through the DNS records.

---

## Option B — Railway

### 1. Create the project

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from
   GitHub repo** → select `hotel-timetrack`.
2. Railway will detect Node and start a first build. It will fail on first
   boot because `JWT_SECRET` is missing — that is expected.

### 2. Add a volume

1. In the project, click **+ New → Volume**.
2. Mount path: `/data`. Size: 1 GB.
3. Attach the volume to the web service.

### 3. Set environment variables

Go to the service → **Variables** and add:

| Variable         | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| `NODE_ENV`       | `production`                                                       |
| `JWT_SECRET`     | the long random value you generated in step 0.                     |
| `ADMIN_EMAIL`    | your admin email                                                   |
| `ADMIN_PASSWORD` | a strong password (only used if the database is empty)             |
| `DATA_DIR`       | `/data` (must match the volume's mount path)                       |

`PORT` is injected by Railway automatically — do not set it.

### 4. Redeploy

Trigger a new deploy. When the logs show `URL: http://localhost:...` and
`Data: /data`, the app is online.

### 5. Migrate existing data (optional)

Install the Railway CLI and copy your local `data/` into the volume:

```bash
npm i -g @railway/cli
railway login
railway link              # pick the project

# Copy each file into the volume (run from the repo root):
railway run --service hotel-timetrack 'cat > /data/users.json'       < data/users.json
railway run --service hotel-timetrack 'cat > /data/hotels.json'      < data/hotels.json
railway run --service hotel-timetrack 'cat > /data/shifts.json'      < data/shifts.json
railway run --service hotel-timetrack 'cat > /data/corrections.json' < data/corrections.json
```

Restart the service. Your existing users and shifts are now online.

### 6. Custom domain (optional)

Service → **Settings → Domains** → **Custom Domain**. Follow the DNS prompts.

---

## Updating the app later

Both Render and Railway redeploy automatically when you push to `main`:

```bash
git add .
git commit -m "Describe your change"
git push
```

The persistent disk / volume is **not** wiped on redeploy — your users and
shifts survive every deploy.

---

## Environment variables — cheat sheet

| Name             | Required           | Purpose                                                              |
| ---------------- | ------------------ | -------------------------------------------------------------------- |
| `NODE_ENV`       | yes (in prod)      | Set to `production`. Enables strict JWT_SECRET check.                |
| `JWT_SECRET`     | yes (in prod)      | Signs auth tokens. Long random string.                               |
| `ADMIN_EMAIL`    | recommended        | Email of the bootstrap admin (only used if DB is empty).             |
| `ADMIN_PASSWORD` | recommended        | Password of the bootstrap admin (only used if DB is empty).          |
| `DATA_DIR`       | yes on Render/Rail | Path to the persistent volume (e.g. `/var/data` or `/data`).         |
| `PORT`           | no                 | Injected by the host. Defaults to `3000` locally.                    |

Local development needs none of these — `npm start` works out of the box and
defaults `DATA_DIR` to `./data`.

---

## Troubleshooting

**`FATAL: JWT_SECRET environment variable is required in production.`**
You forgot to set `JWT_SECRET` in the dashboard, or it is still set to the
default value. Add a long random string and redeploy.

**Users disappear after every deploy.**
You did not attach a persistent disk / volume, OR `DATA_DIR` does not match
the disk's mount path. Both must point at the same path.

**Cannot log in after deploy on a fresh disk.**
On the first boot the server creates one admin from `ADMIN_EMAIL` /
`ADMIN_PASSWORD`. Use those exact credentials. If you mistyped, open the
host's Shell, delete `users.json` from the disk, redeploy, and try again.

**`EACCES: permission denied`** writing to the data dir.
Make sure `DATA_DIR` points at the **mount path** of the disk, not a
sub-directory the process cannot create.
