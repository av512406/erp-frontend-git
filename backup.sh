#!/bin/bash

# Configuration
BACKUP_DIR="/backups"
BACKUP_FREQUENCY_SECONDS=${BACKUP_FREQUENCY_SECONDS:-86400} # Default: 24 hours
S3_BUCKET_NAME=${S3_BUCKET_NAME}

echo "Starting AWS S3 Backup Service..."
echo "Backup Frequency: $BACKUP_FREQUENCY_SECONDS seconds"
echo "Target S3 Bucket: $S3_BUCKET_NAME"

if [ -z "$S3_BUCKET_NAME" ]; then
    echo "Error: S3_BUCKET_NAME is not set!"
    exit 1
fi

# Unset empty AWS credentials to allow fallback to IAM Role
[ -z "$AWS_ACCESS_KEY_ID" ] && unset AWS_ACCESS_KEY_ID
[ -z "$AWS_SECRET_ACCESS_KEY" ] && unset AWS_SECRET_ACCESS_KEY
[ -z "$AWS_REGION" ] && unset AWS_REGION

mkdir -p "$BACKUP_DIR"

    # Calculate seconds until next 2 AM
    current_epoch=$(date +%s)
    current_hour=$(date +%H)
    
    if [ "$current_hour" -lt 2 ]; then
        next_run=$(date -d "today 02:00" +%s)
    else
        next_run=$(date -d "tomorrow 02:00" +%s)
    fi
    
    current_now=$(date +%s)
    sleep_seconds=$((next_run - current_now))
    
    echo "Next backup scheduled for $(date -d @$next_run) (in $sleep_seconds seconds)."
    sleep "$sleep_seconds"

    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    FILENAME="backup_$TIMESTAMP.sql.gz"
    FILEPATH="$BACKUP_DIR/$FILENAME"

    echo "[$TIMESTAMP] Starting scheduled backup..."

    # Run pg_dump
    if pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$FILEPATH"; then
        echo "[$TIMESTAMP] Local backup created: $FILEPATH"
        
        # Upload to S3
        echo "[$TIMESTAMP] Uploading to S3..."
        if aws s3 cp "$FILEPATH" "s3://$S3_BUCKET_NAME/$FILENAME"; then
            echo "[$TIMESTAMP] Upload successful!"
            rm "$FILEPATH"
        else
            echo "[$TIMESTAMP] Upload failed!"
        fi
    else
        echo "[$TIMESTAMP] Backup failed!"
        rm -f "$FILEPATH"
    fi
done
