# Production Deployment Guide

Target: Astro Node standalone app behind Nginx and PM2.

## 1. Pre-Deployment

```sh
npm ci
npm run sync
npm run validate:stripe
npm run astro -- check
npm run build
```

Before deploying live payments, confirm:

- `.env` exists only on the server and is not committed.
- `NODE_ENV=production`.
- `SITE_URL=https://ceprija.edu.mx`.
- `STRIPE_SECRET_KEY` is `sk_live_...`.
- `STRIPE_WEBHOOK_SECRET` is the live Dashboard endpoint secret.
- `STRIPE_ALLOWED_PRICE_IDS` contains every live `price_...` in `src/content/programas`.

## 2. Server Setup

Install dependencies:

```sh
npm ci --omit=dev
```

Create runtime directories:

```sh
mkdir -p data logs
chmod 755 data logs
```

Copy `ecosystem.config.cjs` to the server root and start. The app reads secrets
from `.env` at runtime via the parent shell, so source it **before** starting PM2:

```sh
set -a && source .env && set +a
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

> **Important:** Use `pm2 delete <name> && pm2 start ecosystem.config.cjs` (not
> `pm2 restart` or `pm2 reload`) whenever `.env` changes. Only a fresh `pm2 start`
> after `source .env` picks up new environment variables.

## 3. Nginx

Use `nginx.conf.example` as the base config. After editing:

```sh
sudo nginx -t
sudo systemctl reload nginx
```

Use Certbot or your preferred TLS provider for HTTPS. Stripe webhooks require a publicly trusted HTTPS endpoint.

## 4. Verification

```sh
curl -i https://ceprija.edu.mx/api/health
```

Expected: HTTP `200` with `status: "ok"`.

Then verify:

1. Stripe Dashboard webhook endpoint receives `2xx`.
2. Checkout redirects to `/pago-exitoso`.
3. `/api/confirm-enrollment` confirms the enrollment.
4. Participant/admin emails arrive.
5. `data/failed-emails.jsonl` remains empty.

## 5. Rollback

1. Revert to the previous deployed git revision.
2. Run `npm ci --omit=dev && npm run build`.
3. Restart PM2: `set -a && source .env && set +a && pm2 delete ceprija-site && pm2 start ecosystem.config.cjs && pm2 save`.
4. Check `/api/health`.
5. If Stripe webhooks fail during rollback, leave the same endpoint URL and secret in place.

## 6. Nightly rebuild (server once — not each deploy)

Catalog pages are prerendered. Educación continua with an ISO `date` on or before today
(`America/Mexico_City`) only moves into “Cursos pasados” after a rebuild.
Set `date` to the day enrollment should close (often the start / first session day).

The production host timezone is **UTC**. Prefer a **systemd timer** with explicit
`America/Mexico_City` (cron `CRON_TZ` is easy to mis-schedule on UTC hosts).

**Install once** (already applied on prod if using the timer unit below):

```ini
# /etc/systemd/system/ceprija-nightly-rebuild.service
[Unit]
Description=CEPRIJA nightly catalog rebuild (auto-past programs)

[Service]
Type=oneshot
ExecStart=/var/www/ceprija/scripts/nightly-rebuild.sh
```

```ini
# /etc/systemd/system/ceprija-nightly-rebuild.timer
[Unit]
Description=Run CEPRIJA nightly rebuild at 00:01 Mexico City

[Timer]
OnCalendar=*-*-* 00:01:00
Timezone=America/Mexico_City
Persistent=true

[Install]
WantedBy=timers.target
```

```sh
systemctl daemon-reload
systemctl enable --now ceprija-nightly-rebuild.timer
systemctl list-timers | grep ceprija
```

Script: `scripts/nightly-rebuild.sh` (sets `TZ=America/Mexico_City`, build + `pm2 restart`).

Check: `journalctl -u ceprija-nightly-rebuild.service -n 50` and
`tail -n 50 /var/www/ceprija/logs/nightly-rebuild.log`.

If a legacy crontab entry exists, remove it to avoid double rebuilds:
`crontab -l` → delete the `# BEGIN CEPRIJA nightly-rebuild` block.
