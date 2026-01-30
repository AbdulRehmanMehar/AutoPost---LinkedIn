#!/bin/sh
set -eu

# Load env written by entrypoint (cron jobs may not inherit env reliably)
if [ -f /etc/scheduler.env ]; then
  # shellcheck disable=SC1091
  . /etc/scheduler.env
fi

endpoint="${1:-}"
if [ -z "$endpoint" ]; then
  echo "Missing endpoint (publish|engage|token-refresh|...)" >&2
  exit 2
fi

: "${APP_URL:?APP_URL is required}"
: "${CRON_SECRET:?CRON_SECRET is required}"

# Some endpoints use ?key= param, others use Bearer header
# Try query param method first (more compatible)
curl -G -fsS --data-urlencode "key=$CRON_SECRET" "$APP_URL/api/cron/$endpoint"
