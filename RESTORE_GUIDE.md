# Database Restore Guide

This guide explains how to download your database backup and restore it to a new Docker container.

## 1. Where Backups Are Stored
When you run `./backup_db.sh` on the server, the backup file (e.g., `school_erp_backup_20251128_000000.sql`) is created in the `erp-frontend-git` directory.

## 2. How to Download Backup Locally
To download the backup file to your local machine, use the `scp` command from your **local terminal**:

```bash
# Replace with your actual key path and backup filename
scp -i "path/to/linux_av.pem" ubuntu@ec2-3-111-41-254.ap-south-1.compute.amazonaws.com:/home/ubuntu/erp-frontend-git/school_erp_backup_YYYYMMDD_HHMMSS.sql ./
```

## 3. How to Restore to a New Container
To run a new Docker container with this backup data:

### Option A: Using Docker Compose (Recommended)
1.  Ensure you have `docker-compose.yml` locally.
2.  Start the services:
    ```bash
    docker-compose up -d
    ```
3.  Copy the backup file into the running database container:
    ```bash
    docker cp school_erp_backup_YYYYMMDD_HHMMSS.sql school_erp_db:/backup.sql
    ```
4.  Restore the database:
    ```bash
    docker exec -it school_erp_db psql -U school_erp -d school_erp -f /backup.sql
    ```

### Option B: Using a Standalone Postgres Container
1.  Start a new Postgres container:
    ```bash
    docker run --name new_postgres -e POSTGRES_USER=school_erp -e POSTGRES_PASSWORD=school_erp_pass -e POSTGRES_DB=school_erp -p 5432:5432 -d postgres:16
    ```
2.  Copy the backup file:
    ```bash
    docker cp school_erp_backup_YYYYMMDD_HHMMSS.sql new_postgres:/backup.sql
    ```
3.  Restore the database:
    ```bash
    docker exec -it new_postgres psql -U school_erp -d school_erp -f /backup.sql
    ```
