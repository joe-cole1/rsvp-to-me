# Installation Guide

This guide walks you through deploying **rsvp-to-me** on any machine that can run Docker. You do not need to know how to program, compile code, or manage a database beyond the steps described here.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [What You Are Installing](#what-you-are-installing)
3. [Step 1 — Install Docker](#step-1--install-docker)
4. [Step 2 — Get the Files](#step-2--get-the-files)
5. [Step 3 — Configure Your Environment](#step-3--configure-your-environment)
6. [Step 4 — Start the Application](#step-4--start-the-application)
7. [Step 5 — First Login and Admin Setup](#step-5--first-login-and-admin-setup)
8. [Understanding Your Data & Backups](#understanding-your-data--backups)
9. [Stopping, Starting, and Restarting](#stopping-starting-and-restarting)
10. [HTTPS and Custom Domains](#https-and-custom-domains)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, you need:
- **A machine to run the app on.** This can be a local server, a continuously running desktop/laptop, a Raspberry Pi (4 or 5), a virtual private server (VPS), or a NAS (e.g. Synology, Unraid) supporting Docker.
- **Docker and Docker Compose** installed on that machine.
- **A stable URL or IP address** (e.g., `http://192.168.1.50:3000` or `https://rsvp.yourdomain.com`) where guests can reach the application.
- **An email account** to send invitation blasts, magic links, and reminders (e.g. Gmail, Outlook, or Amazon SES).

---

## What You Are Installing

rsvp-to-me runs as two separate Docker containers that work together:

| Container | Purpose |
|-----------|---------|
| `app` | The main web server. It handles webpage rendering, guest RSVPs, comment boards, and admin actions. Runs on port `3000`. |
| `cron` | A background process runner. It wakes up every 15 minutes to check the database and dispatch scheduled reminder emails and text messages. It has no web interface. |

Both services are defined in a single `docker-compose.yml` file, sharing the same SQLite database and image upload folder. They start, stop, and scale together.

---

## Step 1 — Install Docker

If Docker and Docker Compose are already installed, skip to [Step 2](#step-2--get-the-files).

### Linux (Ubuntu/Debian)
Open your terminal and run the following commands to install Docker:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```
To run Docker commands without needing `sudo` every time, add your current user to the `docker` group:
```bash
sudo usermod -aG docker $USER
```
Log out of your Linux session and log back in to apply this change.

### Mac
Download and install **Docker Desktop** from the [Official macOS Install Page](https://docs.docker.com/desktop/install/mac-install/).

### Windows
Download and install **Docker Desktop** from the [Official Windows Install Page](https://docs.docker.com/desktop/install/windows-install/). Ensure WSL 2 (Windows Subsystem for Linux) is selected during installation.

### Verify the Installation
Verify that Docker is running by printing the versions:
```bash
docker --version
docker compose version
```

---

## Step 2 — Get the Files

You need the `docker-compose.yml` and `.env.example` files to deploy.

### Option A: Clone the Repository (recommended)
If you have Git installed, clone the repository:
```bash
git clone https://github.com/joe-cole1/rsvp-to-me.git
cd rsvp-to-me
```

### Option B: Download the Files Directly
Alternatively, create a directory and download the setup files:
```bash
mkdir rsvp-to-me
cd rsvp-to-me
curl -O https://raw.githubusercontent.com/joe-cole1/rsvp-to-me/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/joe-cole1/rsvp-to-me/main/.env.example
```

---

## Step 3 — Configure Your Environment

All configuration is done in a file named `.env` in the same directory as your `docker-compose.yml`.

### Create the .env File
Copy the example configuration:
- **Linux/Mac:**
  ```bash
  cp .env.example .env
  ```
- **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```

Open the `.env` file in a text editor.

### Minimum Required Variables
You must set at least these four configuration variables before launching:

1. **`SESSION_SECRET`**: A secure, random string (at least 32 characters) used to encrypt user session cookies.
   - *CLI (Linux/Mac):* Run `openssl rand -base64 32` to generate a key.
   - *CLI (Windows PowerShell):* Run `[Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Max 256) }))`.
   - *Web:* Generate it via [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32).
2. **`NEXT_PUBLIC_APP_URL`**: The public URL that users and guests will visit (e.g. `https://rsvp.yourdomain.com`). No trailing slash.
3. **`INITIAL_ADMIN_EMAIL`**: Your email address. Logging in with this email for the first time automatically promotes your account to Administrator.
4. **`HOST_INVITE_CODE`**: A code required by new hosts to register accounts (gating access to your instance). Change it from the default `letmein`!

> **Warning:** Your `.env` file contains sensitive passwords and secrets. Never commit it to a public repository. Ensure it is added to your `.gitignore` file.

---

## Step 4 — Start the Application

From inside your `rsvp-to-me` directory, start the containers:
```bash
docker compose up -d
```
*What this command does:*
- Downloads the web server and background worker Docker images.
- Creates the local database file and runs database migrations.
- Launches the `app` and `cron` containers in the background.

Verify the container status:
```bash
docker compose ps
```

Verify that the web app started successfully by checking the logs:
```bash
docker compose logs -f app
```
Press `Ctrl+C` to stop watching the logs (the containers will remain running).

You can also test the health check endpoint:
```bash
curl http://localhost:3000/api/health
```
It should return: `{"status":"ok"}`.

---

## Step 5 — First Login and Admin Setup

1. Open your browser and go to the URL you configured in `NEXT_PUBLIC_APP_URL`.
2. Click **Sign In** and type the email address you put in `INITIAL_ADMIN_EMAIL`.
3. Check your email inbox for the magic link. Click it to log in.
   - *Note: If email is not yet configured, extract the link manually from the logs:*
     ```bash
     docker compose logs app | grep "magic link"
     ```
4. Once logged in, go to the `/admin` URL in your browser to confirm you have access to the Admin Panel.

---

## Understanding Your Data & Backups

By default, the `docker-compose.yml` mounts a local directory named `./data` on your host machine to `/app/data` inside the containers.

Your data is stored in two paths inside this directory:
- **`./data/prod.db`**: The SQLite database file containing all users, events, RSVPs, comments, polls, and potlucks.
- **`./data/uploads/`**: All uploaded cover images and profile avatars.

### Backing Up Data
Because the files live in your `./data` directory on the host, you can copy them directly for backups.
Always stop the application before copying the database to prevent database corruption.

**Backup Commands (Linux/Mac):**
```bash
# Stop the app to secure the database file
docker compose stop app

# Copy the database and uploads directory
cp ./data/prod.db ./prod-backup-$(date +%Y%m%d).db
cp -r ./data/uploads ./uploads-backup-$(date +%Y%m%d)

# Restart the application
docker compose start app
```

**Backup Commands (Windows PowerShell):**
```powershell
docker compose stop app
Copy-Item ./data/prod.db ./prod-backup-$(Get-Date -Format "yyyyMMdd").db
Copy-Item -Recurse ./data/uploads ./uploads-backup-$(Get-Date -Format "yyyyMMdd")
docker compose start app
```

> **Caution:** Running `docker compose down -v` deletes all Docker volumes. While rsvp-to-me uses a local directory bind mount, running this with custom setups might lead to permanent data loss. Always omit the `-v` flag to protect your data.

---

## Stopping, Starting, and Restarting

Manage your containers using these CLI commands:

- **`docker compose stop`**: Gracefully stops the running application and cron services. Your data remains perfectly safe.
- **`docker compose start`**: Starts the stopped application and cron services.
- **`docker compose restart`**: Restarts both containers (useful after making small modifications).
- **`docker compose down`**: Stops and removes the application containers. The `./data` directory on the host remains intact.

---

## HTTPS and Custom Domains

Next.js session cookies rely on secure contexts. Browsers will block authentication cookies over unencrypted HTTP on public domains. **HTTPS is required for internet-facing installations.**

You do not configure HTTPS inside rsvp-to-me. Instead, run a **reverse proxy** in front of port `3000` to handle SSL certificates (like Let's Encrypt) and forward traffic.

Recommended reverse proxies:
- **Caddy** (Automatic HTTPS, simple single-line reverse proxies): [Caddy Reverse Proxy Quick Start](https://caddyserver.com/docs/quick-starts/reverse-proxy)
- **Nginx Proxy Manager** (Web-based GUI for managing Let's Encrypt certificates): [Nginx Proxy Manager Homepage](https://nginxproxymanager.com/)
- **Traefik** (A cloud-native proxy that integrates directly with Docker labels): [Traefik Docker Documentation](https://doc.traefik.io/traefik/)

---

## Troubleshooting

### The app won't start
Run `docker compose logs app` to inspect the logs.
- If you see `SESSION_SECRET must be at least 32 characters`, make sure you generated a long random string.
- If port `3000` is already in use by another app, open `docker-compose.yml` and change `"3000:3000"` to `"3001:3000"` (or another available port).

### I didn't receive a magic link email
1. If you haven't configured SMTP or Cloudflare credentials yet, retrieve the magic link directly from the logs: `docker compose logs app | grep "magic link"`.
2. Check your spam folder.
3. If configured, go to `/admin` > **System Configuration** > **Send Test Email** to check for configuration errors.

### The cron container keeps restarting
The `cron` service depends on the `app` container. If the web server is still performing migrations on startup, the cron container may fail its initial check and restart. This is expected and will stabilize once the web application is fully ready.

### I lost my administrator access
Ensure `INITIAL_ADMIN_EMAIL="your-email@domain.com"` is set in `.env`, then run:
```bash
docker compose restart app
```
Log out of the application, then log back in using that email address to re-trigger the Admin promotion logic.
