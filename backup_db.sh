#!/bin/bash

# Backup Database Script
# Usage: ./backup_db.sh

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="school_erp_backup_$TIMESTAMP.sql"

echo "📦 Backing up database to $BACKUP_FILE..."

# Dump the database from the running container
docker exec -t school_erp_db pg_dump -U school_erp school_erp > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $BACKUP_FILE"
else
    echo "❌ Backup failed!"
    rm "$BACKUP_FILE"
    exit 1
fi
