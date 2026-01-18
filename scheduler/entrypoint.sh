#!/bin/sh
set -eu

apk add --no-cache curl >/dev/null

echo "Waiting for app health at $APP_URL/api/health ..."
until curl -sf "$APP_URL/api/health" >/dev/null; do
  sleep 2
done

echo "Writing scheduler env..."
{
  printf 'APP_URL=%s\n' "$APP_URL"
  printf 'CRON_SECRET=%s\n' "$CRON_SECRET"
} > /etc/scheduler.env

mkdir -p /var/log
: > /var/log/cron-publish.log
: > /var/log/cron-engage.log

CRONTAB=/etc/crontabs/root
# Keep the default Alpine periodic entries, just append ours once.
if ! grep -q "/scheduler/cron-call.sh publish" "$CRONTAB" 2>/dev/null; then
  echo "*/5 * * * * sh /scheduler/cron-call.sh publish >> /var/log/cron-publish.log 2>&1" >> "$CRONTAB"
fi
if ! grep -q "/scheduler/cron-call.sh engage" "$CRONTAB" 2>/dev/null; then
  echo "*/15 * * * * sh /scheduler/cron-call.sh engage >> /var/log/cron-engage.log 2>&1" >> "$CRONTAB"
fi

echo "Cron jobs installed:"
cat "$CRONTAB"

echo "Starting crond..."
exec crond -f -l 2
