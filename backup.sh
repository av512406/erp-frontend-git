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

while true; do
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    FILENAME="backup_$TIMESTAMP.sql.gz"
    FILEPATH="$BACKUP_DIR/$FILENAME"

    echo "[$TIMESTAMP] Starting backup..."

    # Run pg_dump
    if pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$FILEPATH"; then
        echo "[$TIMESTAMP] Local backup created: $FILEPATH"
        
        # Upload to S3
        echo "[$TIMESTAMP] Uploading to S3..."
        if aws s3 cp "$FILEPATH" "s3://$S3_BUCKET_NAME/$FILENAME"; then
            echo "[$TIMESTAMP] Upload successful!"
            # Remove local file after successful upload
            rm "$FILEPATH"
        else
            echo "[$TIMESTAMP] Upload failed!"
        fi
    else
        echo "[$TIMESTAMP] Backup failed!"
        rm -f "$FILEPATH"
    fi

    echo "Next backup in $BACKUP_FREQUENCY_SECONDS seconds."
    sleep "$BACKUP_FREQUENCY_SECONDS"
done
