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

### Method 1: Copy from Stopped Container (recommended)
Stop the web server, copy the database file and uploads, then restart:

- **Linux/Mac (Terminal):**
  ```bash
  # Stop the app container (stops database writes)
  docker compose stop app

  # Copy the database and uploads directory to your host folder
  docker cp rsvp-to-me-app-1:/app/data/prod.db ./prod-backup-$(date +%Y%m%d-%H%M%S).db
  docker cp rsvp-to-me-app-1:/app/data/uploads ./uploads-backup-$(date +%Y%m%d-%H%M%S)

  # Restart the web server
  docker compose start app
  ```

- **Windows (PowerShell):**
  ```powershell
  # Stop the app container
  docker compose stop app

  # Copy the database and uploads directory
  docker cp rsvp-to-me-app-1:/app/data/prod.db ./prod-backup-$(Get-Date -Format "yyyyMMdd-HHmmss").db
  docker cp rsvp-to-me-app-1:/app/data/uploads ./uploads-backup-$(Get-Date -Format "yyyyMMdd-HHmmss")

  # Restart the web server
  docker compose start app
  ```

> **Note:** The container name `rsvp-to-me-app-1` may vary depending on your directory name. Run `docker compose ps` to verify the exact container name.

### Method 2: Hot Copy while Running (faster but slightly riskier)
SQLite supports copying the file while the application is active. This is faster but carries a small risk of copying the file mid-write.
```bash
docker cp rsvp-to-me-app-1:/app/data/prod.db ./prod-backup-$(date +%Y%m%d).db
```

### Where to Store Backups
- On a separate machine, drive, or local NAS.
- Encrypted cloud storage (e.g. Google Drive, Dropbox, Backblaze B2).
- The SQLite database file is typically very small (<10MB) and compresses easily.

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
  docker compose stop app
  docker cp rsvp-to-me-app-1:/app/data/prod.db ./prod-backup-$(date +%Y%m%d).db
  docker compose start app
  docker compose pull
  docker compose up -d
  docker compose logs -f app
  ```
- **Windows (PowerShell):**
  ```powershell
  docker compose stop app
  docker cp rsvp-to-me-app-1:/app/data/prod.db ./prod-backup-$(Get-Date -Format "yyyyMMdd").db
  docker compose start app
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

If you experience issues, rollback to the previous version.

### Step 1: Restore your Database Backup
```bash
# Stop the app container
docker compose stop app

# Overwrite the database with your backup
docker cp ./prod-backup-20240315.db rsvp-to-me-app-1:/app/data/prod.db

# Restart the app
docker compose start app
```

### Step 2: Pin the Previous Image Version
Open your `docker-compose.yml` file and edit the image tag to reference the specific previous release version (e.g. `v1.2.0` instead of `latest`):
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

> **Warning:** Rolling back to a previous version after a schema migration has run may cause database schema mismatch errors. This is why copying a database backup **prior** to running `docker compose pull` is critical.

---

## Setting Up Automatic Backups

### Option A: Bind Mount Directory
By default, the `docker-compose.yml` file uses a bind mount directory:
```yaml
    volumes:
      - ./data:/app/data
```
This means the database file is always accessible on your host machine at `./data/prod.db` relative to your `docker-compose.yml`. You can direct any standard host-level backup tool (e.g. Restic, Duplicati, or Backblaze) to backup this directory.

---

### Option B: Scheduled Cron Script (Linux/Mac)
You can set up a daily cron job on your host machine to automate backups.

1. Create a script file `/home/user/backup-rsvp.sh`:
   ```bash
   #!/bin/bash
   BACKUP_DIR="/home/user/rsvp-backups"
   DATE=$(date +%Y%m%d-%H%M%S)
   mkdir -p "$BACKUP_DIR"

   # Stop container to prevent write locks
   docker compose -f /path/to/rsvp-to-me/docker-compose.yml stop app

   # Copy database
   cp /path/to/rsvp-to-me/data/prod.db "$BACKUP_DIR/prod-$DATE.db"

   # Restart container
   docker compose -f /path/to/rsvp-to-me/docker-compose.yml start app

   # Keep only the last 30 backups
   ls -t "$BACKUP_DIR"/*.db | tail -n +31 | xargs rm -f
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
