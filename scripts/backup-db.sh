#!/usr/bin/env bash
# Daily MySQL backup script.
# Stores compressed backups locally and optionally uploads to DigitalOcean Spaces.
#
# Setup (run once on the droplet):
#   chmod +x ~/estate-manager/scripts/backup-db.sh
#   crontab -e
#   Add: 0 2 * * * /root/estate-manager/scripts/backup-db.sh >> /var/log/estate-backup.log 2>&1

set -e

# ── Config ────────────────────────────────────────────────────────────────────
BACKUP_DIR="/root/backups/estate"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/estate_${DATE}.sql.gz"
CONTAINER="estate-manager-mysql_db-1"
KEEP_DAYS=30

# Optional: DigitalOcean Spaces upload
# Fill these in to enable cloud backup, otherwise leave blank.
SPACES_BUCKET=""       # e.g. "my-estate-backups"
SPACES_REGION=""       # e.g. "fra1"
SPACES_KEY=""          # Spaces access key
SPACES_SECRET=""       # Spaces secret key

# ── Load DB password from .env ────────────────────────────────────────────────
ENV_FILE="/root/estate-manager/.env"
if [ -f "$ENV_FILE" ]; then
  DB_PASSWORD=$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d'=' -f2)
fi
DB_PASSWORD="${DB_PASSWORD:-estate}"

# ── Backup ────────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

docker exec "$CONTAINER" \
  mysqldump -u estate -p"${DB_PASSWORD}" \
  --single-transaction --routines --triggers estate \
  | gzip > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup saved: $BACKUP_FILE ($SIZE)"

# ── Upload to DigitalOcean Spaces (optional) ──────────────────────────────────
if [ -n "$SPACES_BUCKET" ] && [ -n "$SPACES_KEY" ]; then
  if ! command -v aws &>/dev/null; then
    apt-get install -y awscli -qq
  fi

  AWS_ACCESS_KEY_ID="$SPACES_KEY" \
  AWS_SECRET_ACCESS_KEY="$SPACES_SECRET" \
  aws s3 cp "$BACKUP_FILE" \
    "s3://${SPACES_BUCKET}/$(basename "$BACKUP_FILE")" \
    --endpoint-url "https://${SPACES_REGION}.digitaloceanspaces.com" \
    --no-progress

  echo "[$(date)] Uploaded to Spaces: s3://${SPACES_BUCKET}/$(basename "$BACKUP_FILE")"
fi

# ── Rotate old local backups ──────────────────────────────────────────────────
DELETED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${KEEP_DAYS} -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[$(date)] Deleted $DELETED backup(s) older than ${KEEP_DAYS} days"
fi

echo "[$(date)] Done."
