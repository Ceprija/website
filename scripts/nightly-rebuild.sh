#!/usr/bin/env bash
# Nightly rebuild so educación continua auto-archives (ISO `date` → effective "past")
# appear in catalog listings. Invoked by root crontab on the production server.
# Cron itself is installed once on the host — not part of each deploy.
set -euo pipefail

cd /var/www/ceprija

export PATH="/usr/bin:/bin:/usr/local/bin:${PATH:-}"

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "[$(date -Is)] nightly rebuild start (HEAD=$(git rev-parse --short HEAD 2>/dev/null || echo unknown))"

npm run build
pm2 restart ceprija-site

echo "[$(date -Is)] nightly rebuild ok"
