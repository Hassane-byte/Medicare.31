#!/usr/bin/env bash
# Sauvegarde de MediCare31 : base de données et pièces jointes.
#
#   ./scripts/backup.sh /var/backups/medicare31
#
# Le script conserve les 14 dernières sauvegardes.
set -euo pipefail

DEST="${1:-./backups}"
KEEP="${KEEP:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

mkdir -p "$DEST"

echo "→ Sauvegarde de la base de données…"
$COMPOSE exec -T db pg_dump \
  -U "${POSTGRES_USER:-medicare_admin}" \
  -d "${POSTGRES_DB:-medicaredb}" \
  --clean --if-exists \
  | gzip > "$DEST/db-$STAMP.sql.gz"

echo "→ Sauvegarde des pièces jointes…"
$COMPOSE run --rm -T --no-deps --entrypoint tar backend \
  -C /app -cf - uploads 2>/dev/null | gzip > "$DEST/uploads-$STAMP.tar.gz" || {
    echo "  (aucun volume de pièces jointes à sauvegarder)"
    rm -f "$DEST/uploads-$STAMP.tar.gz"
  }

echo "→ Nettoyage des sauvegardes de plus de $KEEP jours…"
find "$DEST" -name 'db-*.sql.gz' -mtime +"$KEEP" -delete
find "$DEST" -name 'uploads-*.tar.gz' -mtime +"$KEEP" -delete

echo "✓ Sauvegarde terminée : $DEST/db-$STAMP.sql.gz"
