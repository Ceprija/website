#!/usr/bin/env bash
# Nightly rebuild so educación continua auto-archives (ISO `date` → effective "past")
# appear in catalog listings. Invoked hourly by systemd; runs once after local midnight.
# Install once on the host — not part of each deploy.
set -euo pipefail

cd /var/www/ceprija

export PATH="/usr/bin:/bin:/usr/local/bin:${PATH:-}"
export TZ="America/Mexico_City"

mkdir -p logs
stamp_file="logs/nightly-rebuild.stamp"
today="$(date +%F)"
hour="$(date +%H)"

# Gate: only in the 00:xx Mexico City hour, once per calendar day.
# (Host clock is UTC; systemd Timers here do not support Timezone=.)
if [[ "${FORCE_NIGHTLY_REBUILD:-}" != "1" ]]; then
  if [[ "$hour" != "00" ]]; then
    exit 0
  fi
  if [[ -f "$stamp_file" && "$(cat "$stamp_file")" == "$today" ]]; then
    exit 0
  fi
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

{
  echo "[$(date -Is)] nightly rebuild start (HEAD=$(git rev-parse --short HEAD 2>/dev/null || echo unknown) today=${today})"
  npm run build
  pm2 restart ceprija-site
  echo "$today" > "$stamp_file"
  echo "[$(date -Is)] nightly rebuild ok"
} >> logs/nightly-rebuild.log 2>&1
