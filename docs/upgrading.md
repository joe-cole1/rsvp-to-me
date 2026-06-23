# Safe Upgrading Guide

This guide explains how to safely pull new versions of **rsvp-to-me**, perform database backups, run migrations, and verify your upgrade.

---

## Table of Contents

1. [How Updates Work](#how-updates-work)
2. [Before You Upgrade — Back Up Your Data](#before-you-upgrade--back-up-your-data)
3. [Checking the Current Version](#checking-the-current-version)
4. [Performing the Upgrade](#performing-the-upgrade)
5. [Database Migrations](#database-migrations)
6. [Verifying the Upgrade](#verifying-the-upgrade)
7. [Rolling Back](#rolling-back)
8. [Setting Up Automatic Backups](#setting-up-automatic-backups)

---

## How Updates Work

rsvp-to-me is distributed as a pre-built Docker image. When a new version is released:
- A new Docker image is pushed to our container registry.
- The image is tagged with the release version and also updates the `latest` tag.
- Database migrations (if any) are applied automatically when the new container starts.

Your `docker-compose.yml` uses the `latest` tag by default. Running `docker compose pull` automatically fetches the most recent release.

> **Note:** Docker does not automatically update running containers. You must manually pull and restart services to run the updated code.

---

## Before You Upgrade — Back Up Your Data

Always perform a backup before upgrading.

### Method 1: pg_dump via the Postgres Container (recommended)
Use `pg_dump` to create a SQL dump while the application is running:

```bash
docker compose exec postgres pg_dump -U postgres rsvp_db > ./data/backups/pre-upgrade-$(date +%Y%m%d-%H%M%S).sql
```

Also back up your uploaded images:
```bash
cp -r ./data/uploads ./uploads-backup-$(date +%Y%m%d-%H%M%S)
```

### Method 2: Built-in Admin Backup Panel
Navigate to `/admin` → **Backups** and click **Back Up Now** to create a `pg_dump` snapshot via the Admin UI.

### Where to Store Backups
- On a separate machine, drive, or local NAS.
- Encrypted cloud storage (e.g. Google Drive, Dropbox, Backblaze B2).
- SQL dump files compress well with gzip: `gzip ./data/backups/pre-upgrade-*.sql`.

---

## Checking the Current Version

To see which image version your system is currently running:
```bash
docker compose images
```
To inspect the specific container:
```bash
docker inspect rsvp-to-me-app-1 | grep -i "image"
```

---

## Performing the Upgrade

### Step 1: Read the Release Notes
Check the [Releases Page](https://github.com/joe-cole1/rsvp-to-me/releases) for breaking changes, required `.env` variables, or custom instructions.

### Step 2: Back Up the Database
Follow [Method 1](#method-1-copy-from-stopped-container-recommended) to copy your database.

### Step 3: Pull the New Image
Download the latest image from the container registry:
```bash
docker compose pull
```
*Note:* This downloads the image layers in the background without affecting your active site.

### Step 4: Re-Launch Services
Re-create and launch the containers:
```bash
docker compose up -d
```
*What this does:*
- Stops the running services.
- Re-creates the containers using the newly downloaded image.
- Runs database migrations automatically on startup.
- Typical downtime is under 30 seconds.

### Complete Upgrade Script (copy-paste)
- **Linux/Mac:**
  ```bash
  docker compose exec postgres pg_dump -U postgres rsvp_db > ./data/backups/pre-upgrade-$(date +%Y%m%d).sql
  docker compose pull
  docker compose up -d
  docker compose logs -f app
  ```
- **Windows (PowerShell):**
  ```powershell
  docker compose exec postgres pg_dump -U postgres rsvp_db | Out-File -FilePath "./data/backups/pre-upgrade-$(Get-Date -Format 'yyyyMMdd').sql" -Encoding utf8
  docker compose pull
  docker compose up -d
  docker compose logs -f app
  ```

---

## Database Migrations

rsvp-to-me handles database migrations automatically when the container starts. On boot, the `app` container executes `npx prisma migrate deploy` to check and apply any new schema updates.

### If a Migration Fails
If a migration fails on startup:
1. Stop the containers:
   ```bash
   docker compose down
   ```
2. Check the startup logs:
   ```bash
   docker compose logs app
   ```
3. Look for errors containing `migrate deploy` or database locking.
4. **Do not repeatedly restart the container.** If a migration failed halfway through, continuous restarts may corrupt the database structure.
5. Restore your backup (see [Rolling Back](#rolling-back)) and open an issue on the project's GitHub.

---

## Verifying the Upgrade

Verify that the upgrade went smoothly:
```bash
# Check container status (both must show 'Up')
docker compose ps

# Check logs for errors
docker compose logs app | tail -50

# Query the health endpoint
curl http://localhost:3000/api/health
```
*Expected Health Response:* `{"status":"ok"}`

Go to your event page and test functionality:
- Log in and verify that your dashboard loads.
- Open an event in an incognito window and test submitting an RSVP.
- Go to `/admin` > **System Configuration** and click **Send Test Email** to verify mail delivery.

---

## Rolling Back

If you experience issues, you can roll back your application to the previous working version.

### Step 1: Restore your Database Backup

To restore a PostgreSQL `.sql` backup, feed it into `psql` via the Postgres container:
```bash
# Drop and recreate the database to get a clean slate, then restore
docker compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS rsvp_db;"
docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE rsvp_db;"
docker compose exec -T postgres psql -U postgres -d rsvp_db < ./data/backups/pre-upgrade-20260623.sql
```

### Step 2: Pin the Previous Image Version
Open your `docker-compose.yml` or `docker-compose.postgres.yml` file and edit the image tag to reference the specific previous release version (e.g. `v1.2.0` instead of `latest`):
```yaml
services:
  app:
    image: ghcr.io/joe-cole1/rsvp-to-me:v1.2.0
```
Pull the pinned image and re-launch:
```bash
docker compose pull
docker compose up -d
```

> **Warning:** Rolling back to a previous version after a schema migration has run may cause database schema mismatch errors. This is why having a database backup **prior** to running `docker compose pull` is critical.

---

## Setting Up Automatic Backups

### Option A: Built-in Admin Backup Scheduler
Navigate to `/admin` → **Backups** and configure a cron schedule (e.g. `0 3 * * *` for daily at 3 AM). The application runs `pg_dump` on schedule and stores the results in `./data/backups/`. Rotation and download are also managed from this panel.

---

### Option B: Host-Level Cron Script (Linux/Mac)
For an extra layer of offsite protection, you can run a host cron job alongside the built-in scheduler.

1. Create a script file `/home/user/backup-rsvp.sh`:
   ```bash
   #!/bin/bash
   BACKUP_DIR="/home/user/rsvp-backups"
   DATE=$(date +%Y%m%d-%H%M%S)
   mkdir -p "$BACKUP_DIR"

   docker compose -f /path/to/rsvp-to-me/docker-compose.yml exec -T postgres \
     pg_dump -U postgres rsvp_db > "$BACKUP_DIR/rsvp-$DATE.sql"

   # Keep only the last 30 backups
   ls -t "$BACKUP_DIR"/*.sql | tail -n +31 | xargs rm -f
   ```
2. Make the script executable:
   ```bash
   chmod +x /home/user/backup-rsvp.sh
   ```
3. Add the script to your cron table:
   ```bash
   crontab -e
   ```
   Add this line to run the backup daily at 3:00 AM:
   ```
   0 3 * * * /home/user/backup-rsvp.sh >> /home/user/rsvp-backup.log 2>&1
   ```

---

## Upgrading the PostgreSQL Major Version

rsvp-to-me uses PostgreSQL 18. When a new major PostgreSQL version is released and you want to upgrade, use the dump-and-restore method (not `pg_upgrade`, which requires native binary installations).

**This procedure requires a brief maintenance window.**

1. **Back up your data** (follow Method 1 above).

2. **Stop the application:**
   ```bash
   docker compose down
   ```

3. **Update the Postgres image tag** in `docker-compose.yml`:
   ```yaml
   postgres:
     image: postgres:19-alpine   # bump to the new major version
   ```

4. **Delete the old data directory** (incompatible between major versions):
   ```bash
   rm -rf ./pg_data
   ```

5. **Start only the new Postgres container** and wait for it to initialize:
   ```bash
   docker compose up -d postgres
   docker compose logs -f postgres   # wait until "database system is ready"
   ```

6. **Restore your backup:**
   ```bash
   docker compose exec -T postgres psql -U postgres -d rsvp_db < ./data/backups/pre-upgrade-YYYYMMDD.sql
   ```

7. **Start all services:**
   ```bash
   docker compose up -d
   docker compose logs -f app
   ```

8. **Verify** by navigating to your app URL and running a quick sanity check on the dashboard and a public event page.
