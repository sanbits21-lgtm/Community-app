#!/usr/bin/env bash
# Restore from a backup made by backup.sh. DESTRUCTIVE: replaces the current database and photos.
#   ./deploy/restore.sh /var/backups/sangha/db-2026-11-01-0300.archive.gz /var/backups/sangha/uploads-2026-11-01-0300.tgz
set -euo pipefail

DB_FILE="${1:?usage: restore.sh <db-...archive.gz> <uploads-...tgz>}"
UPLOADS_FILE="${2:?usage: restore.sh <db-...archive.gz> <uploads-...tgz>}"
cd "$(dirname "$0")/.."

read -r -p "This REPLACES the live database and photos. Type 'restore' to continue: " ok
[ "$ok" = "restore" ] || { echo "cancelled"; exit 1; }

docker compose exec -T mongo mongorestore --quiet --archive --gzip --drop < "$DB_FILE"
docker run --rm -v sangha_uploads:/data -v "$(dirname "$(readlink -f "$UPLOADS_FILE")")":/in:ro alpine \
  sh -c "rm -rf /data/* && tar xzf /in/$(basename "$UPLOADS_FILE") -C /data"
docker compose restart app
echo "restored"
