#!/bin/bash
#
# Greyin Postgres backup script
#
# Replaces the previous version of this file, which targeted containers
# (greyin_postgres, greyin_odoo, discourse_postgres) from a pre-Supabase
# iteration of this stack that no longer exist -- it had silently stopped
# doing anything useful. This one targets the actual production database:
# the single shared Postgres instance behind all 5 apps, running as a
# Docker Swarm service (container name has a random per-task suffix, so
# it's resolved at run time rather than hardcoded).
#
# Local-disk backups only -- this protects against accidental data loss
# (bad migration, dropped table, human error), not against the host
# itself failing or its disk dying. Off-host replication (rsync to
# another machine, S3, etc.) is a separate, deliberate step -- see
# IMPLEMENTATION_VS_REQUIREMENTS.md's SRE section for why this matters.
#
# Usage: run daily via cron, e.g.:
#   0 2 * * * /media/anand/WD\ BLACK/projects2/greyin/deployment/backup.sh >> /media/anand/WD\ BLACK/projects2/greyin/deployment/backups/backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=14

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

mkdir -p "$BACKUP_DIR"

DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep supabase_supabase_db | head -1)
if [ -z "$DB_CONTAINER" ]; then
  error "Could not find a running supabase_supabase_db container -- nothing backed up."
  exit 1
fi

DUMP_FILE="$BACKUP_DIR/postgres_${DATE}.sql.gz"
log "Backing up $DB_CONTAINER -> $DUMP_FILE"

# pg_dumpall (not pg_dump) so roles/grants are captured too, not just the
# postgres database's own objects.
if docker exec "$DB_CONTAINER" pg_dumpall -U postgres | gzip > "$DUMP_FILE"; then
  SIZE=$(du -h "$DUMP_FILE" | cut -f1)
  log "Backup complete: $DUMP_FILE ($SIZE)"
else
  error "pg_dumpall failed"
  rm -f "$DUMP_FILE"
  exit 1
fi

# Sanity check: a near-empty gzip almost always means pg_dumpall failed
# partway through without a non-zero exit (seen this before with piped
# commands under `set -e` -- the pipe's exit status is gzip's, not
# pg_dumpall's, without pipefail).
MIN_BYTES=10000
ACTUAL_BYTES=$(stat -c%s "$DUMP_FILE" 2>/dev/null || stat -f%z "$DUMP_FILE")
if [ "$ACTUAL_BYTES" -lt "$MIN_BYTES" ]; then
  error "Backup file is suspiciously small ($ACTUAL_BYTES bytes) -- treating as failed."
  exit 1
fi

log "Pruning backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name 'postgres_*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete

log "Done."
