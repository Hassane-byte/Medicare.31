#!/usr/bin/env bash
# Restauration d'une sauvegarde de MediCare31.
#
#   ./scripts/restore.sh backups/db-20260101-120000.sql.gz
set -euo pipefail

ARCHIVE="${1:?Usage : ./scripts/restore.sh <archive.sql.gz>}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

if [ ! -f "$ARCHIVE" ]; then
  echo "Archive introuvable : $ARCHIVE" >&2
  exit 1
fi

echo "→ Lecture de la sauvegarde…"
gzip -dc "$ARCHIVE" | $COMPOSE exec -T db psql \
  -U "${POSTGRES_USER:-medicare_admin}" \
  -d "${POSTGRES_DB:-medicaredb}"

echo "✓ Restauration terminée depuis $ARCHIVE"
