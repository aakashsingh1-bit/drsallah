# Dr. Salah Alzait — Production Deployment (Docker + Caddy)

Deploy everything on one fresh Linux server with automatic HTTPS.

| Service | Domain |
|---------|--------|
| Student web app | `https://web.drsalahalzait.me` |
| Admin panel | `https://admin.drsalahalzait.me` |
| Backend API | `https://api.drsalahalzait.me` |

---

## Architecture

```
Internet
   │
   ▼
Caddy (:80 / :443)  ── automatic Let's Encrypt SSL
   ├── web.drsalahalzait.me   →  web container (nginx + React build)
   ├── admin.drsalahalzait.me →  admin container (nginx + React build)
   └── api.drsalahalzait.me   →  api container (Node.js :5000)
                                      │
                                      ▼
                                 MongoDB (Docker volume)
```

---

## Step 1 — DNS (do this first)

In your domain registrar, add **A records** pointing to your server public IP:

| Type | Name | Value |
|------|------|--------|
| A | `web` | `YOUR_SERVER_IP` |
| A | `admin` | `YOUR_SERVER_IP` |
| A | `api` | `YOUR_SERVER_IP` |

Wait 5–30 minutes, then verify:

```bash
dig +short web.drsalahalzait.me
dig +short admin.drsalahalzait.me
dig +short api.drsalahalzait.me
```

All should return your server IP.

---

## Step 2 — Prepare the server

Ubuntu 22.04/24.04 recommended. SSH in as root or sudo user.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw
```

### Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

> Do **not** expose MongoDB (27017) to the internet.

---

## Step 3 — Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Log out and back in, then verify:

```bash
docker --version
docker compose version
```

---

## Step 4 — Clone the project

```bash
sudo mkdir -p /opt/drsalah
sudo chown $USER:$USER /opt/drsalah
cd /opt/drsalah

git clone YOUR_REPO_URL .
```

---

## Step 5 — Configure environment

```bash
cd deploy
cp .env.example .env
nano .env
```

Fill in **all** values. Minimum required:

| Variable | Example |
|----------|---------|
| `CADDY_EMAIL` | `support@drsalahalzait.me` (for SSL certificates) |
| `JWT_SECRET` | long random string |
| `JWT_REFRESH_SECRET` | another long random string |
| `AWS_*` | S3 credentials for video storage |
| `SMTP_*` | email for OTP / password reset |
| `STRIPE_*` | live keys when ready |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |

Domains are pre-set in `.env.example`:

- `WEB_DOMAIN=web.drsalahalzait.me`
- `ADMIN_DOMAIN=admin.drsalahalzait.me`
- `API_DOMAIN=api.drsalahalzait.me`

### MongoDB options

**Option A — Docker Mongo (default, easiest)**

Keep in `.env`:

```
MONGO_URI=mongodb://mongodb:27017/drsallah
```

**Option B — MongoDB Atlas**

Set your Atlas connection string:

```
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/drsallah
```

If using Atlas only, remove the `mongodb` service from `docker-compose.yml`.

---

## Step 6 — Build and start

```bash
cd /opt/drsalah/deploy
docker compose up -d --build
```

First build takes 5–15 minutes. Watch logs:

```bash
docker compose logs -f
```

Check containers:

```bash
docker compose ps
```

---

## Step 7 — Seed admin user

```bash
docker compose exec api node seed.js
docker compose exec api node seed-demo.js
```

Default admin (change password after first login):

- **Email:** `admin@drsallah.com`
- **Password:** `Admin@12345`

Demo test student (pre-enrolled in demo course):

- **Email:** `student@test.drsallahalzait.me`
- **Password:** `Test@12345`
- **Course:** MRCP PACES Demo Course (2 modules, 6 lessons)

---

## Step 8 — Verify deployment

| URL | Expected |
|-----|----------|
| https://api.drsalahalzait.me/health | `{"success":true,...}` |
| https://api.drsalahalzait.me/api-docs | API documentation |
| https://web.drsalahalzait.me | Student login page |
| https://admin.drsalahalzait.me | Admin login page |

---

## Step 9 — Stripe webhook (payments)

In [Stripe Dashboard](https://dashboard.stripe.com/webhooks):

1. **Add endpoint:** `https://api.drsalahalzait.me/api/v1/payments/stripe/webhook`
2. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET` in `.env`
3. Restart API:

```bash
docker compose up -d api
```

---

## Video delivery (YouTube-style adaptive)

**Playback:** API prefers **HLS** (`hlsUrl` → 360p/720p auto bitrate via `hls.js`). Optimized progressive MP4 (`streamUrl`) is the fallback. Tokenized playlist URLs use your existing API domain — no extra CDN required.

**After admin upload:** one background job builds (1) 720p progressive MP4 and (2) HLS ladder. Max 3 attempts then stop. Never optimizes on every play.

```env
VIDEO_PROCESSING_ENABLED=true
VIDEO_HLS_ENABLED=true
VIDEO_OPTIMIZE_EXISTING_ON_STARTUP=false
VIDEO_OPTIMIZE_MAX_ATTEMPTS=3
```

After deploy, rebuild old lessons for HLS once:

```bash
# Admin JWT
curl -X POST https://api.drsalahalzait.me/api/v1/admin/videos/optimize-all \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

Hard-refresh the student web app after deploy so it no longer caches an old HQ stream URL.

Ensure S3 bucket CORS allows `GET`/`HEAD` from `https://web.drsalahalzait.me` and `https://admin.drsalahalzait.me`.

---

## Step 10 — Go live checklist

- [ ] DNS A records live
- [ ] HTTPS works on all 3 domains
- [ ] Student signup + OTP email works
- [ ] Admin login at `admin.drsalahalzait.me`
- [ ] Video upload in admin plays on web
- [ ] Stripe payment test on web
- [ ] Change default admin password

---

## Common commands

```bash
cd /opt/drsalah/deploy

docker compose up -d
git pull && docker compose up -d --build
docker compose logs -f api
docker compose restart api
docker compose down
```

After changing `VITE_API_BASE_URL` or `REACT_APP_API_URL`:

```bash
docker compose up -d --build web admin
```

---

## Troubleshooting

**SSL failed** — DNS must point to server; ports 80/443 open; set `CADDY_EMAIL`.

**CORS errors** — set `CLIENT_URL` and `ADMIN_URL` in `.env`, restart API.

**502 on API** — `docker compose logs api` (wait for MongoDB healthy).

**Rate limit** — `docker compose restart api`

**`npm ci` failed during Docker build** — pull latest code (needs `package-lock.json` in each app folder), then:

```bash
cd /opt/drsalah/drsallah/deploy
docker compose build --no-cache admin web api
docker compose up -d
```

If it still fails, on the server check lock files exist:

```bash
ls -la ../admin-panel/package-lock.json ../web/package-lock.json ../Backend/package-lock.json
```
