#!/usr/bin/env bash
# Nightly backup of the database and uploaded photos. Run from cron (see docs/DEPLOY.md).
#   BACKUP_DIR   where to keep backups            (default /var/backups/sangha)
#   KEEP_DAYS    how long to keep them            (default 14)
#   RCLONE_REMOTE optional offsite copy, e.g. "hetzner-box:sangha"  (needs rclone configured)
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="${BACKUP_DIR:-/var/backups/sangha}"
KEEP="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d-%H%M)"
mkdir -p "$OUT"

DB_FILE="$OUT/db-$STAMP.archive.gz"
docker compose exec -T mongo mongodump --quiet --archive --gzip --db sangha > "$DB_FILE"

# An empty or tiny dump means something went wrong; fail loudly instead of keeping a useless "backup".
if [ "$(stat -c %s "$DB_FILE")" -lt 200 ]; then
  echo "backup failed: database dump is suspiciously small" >&2
  rm -f "$DB_FILE"
  exit 1
fi

docker run --rm -v sangha_uploads:/data:ro -v "$OUT":/out alpine \
  tar czf "/out/uploads-$STAMP.tgz" -C /data .

find "$OUT" -type f \( -name 'db-*.archive.gz' -o -name 'uploads-*.tgz' \) -mtime +"$KEEP" -delete

if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$OUT" "$RCLONE_REMOTE" --max-age "${KEEP}d"
fi

echo "backup ok: $DB_FILE"
