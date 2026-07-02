---
title: Installation
description: Docker setup, deployment, HTTPS, and troubleshooting.
category: Getting Started
audience: admin
order: 10
---

# Installation Guide

This guide walks you through deploying **RSVP to Me** on any machine that can run Docker. You do not need to know how to program, compile code, or manage a database beyond the steps described here.

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

RSVP to Me runs as a set of Docker containers defined in `docker-compose.yml`:

| Container  | Purpose                                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app`      | The main web server. It handles webpage rendering, guest RSVPs, comment boards, and admin actions. It also runs the in-process cron scheduler for reminders and backups. Runs on port `3000`. |
| `postgres` | PostgreSQL 18 database — stores all users, events, RSVPs, and application data. Reachable only by the other containers on the internal Docker network — it is **not** exposed on a host port. |
| `redis`    | Redis — session caching, rate limiting, and distributed cron locking. Internal-only, like `postgres` — no host port is exposed.                                                               |

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

You must set at least these variables before launching:

1. **`POSTGRES_PASSWORD`**: A secure password for the PostgreSQL database container.
2. **`REDIS_PASSWORD`**: A secure password for the Redis container.
   > **These two are enforced.** The compose files ship **no default passwords** — if either variable is missing or empty, `docker compose up` refuses to start and prints an error naming the variable (e.g. `POSTGRES_PASSWORD is required - set a strong value in .env`). The database and cache are also not published on host ports, so they are only reachable by the app container on the internal Docker network.
3. **`SESSION_SECRET`**: A secure, random string (at least 32 characters) used to encrypt user session cookies.
   - _CLI (Linux/Mac):_ Run `openssl rand -base64 32` to generate a key.
   - _CLI (Windows PowerShell):_ Run `[Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Max 256) }))`.
   - _Web:_ Generate it via [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32).
4. **`NEXT_PUBLIC_APP_URL`**: The public URL that users and guests will visit (e.g. `https://rsvp.yourdomain.com`). No trailing slash.
5. **`INITIAL_ADMIN_EMAIL`**: Your email address. Logging in with this email for the first time automatically promotes your account to Administrator.
6. **`HOST_INVITE_CODE`**: A code required by new hosts to register accounts (gating access to your instance). The `.env.example` placeholder (`CHANGE_THIS_TO_A_STRONG_RANDOM_CODE`) is rejected at startup in production — replace it with a strong value (e.g. `openssl rand -hex 8`).

> **Warning:** Your `.env` file contains sensitive passwords and secrets. Never commit it to a public repository. Ensure it is added to your `.gitignore` file.

---

## Step 4 — Start the Application

From inside your `rsvp-to-me` directory, start the containers:

```bash
docker compose up -d
```

_What this command does:_

- Downloads and starts the PostgreSQL 18, Redis, and web server containers.
- Runs database migrations automatically on first startup.
- Launches all containers in the background.

> **Heads up — sample data:** The default `docker-compose.yml` sets `SEED_TEST_DATA: "true"`, so on a **fresh, empty database** the first startup seeds example data (sample users and events) to help you explore the app. If you want a clean production install with no sample data, set `SEED_TEST_DATA` to `"false"` in your `docker-compose.yml` (the included `docker-compose.dev.yml` already uses `"false"`). Seeding is skipped automatically once the database already contains events, so it won't duplicate data on later restarts.

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

## Deploying from GitHub (No Local Clone Required)

If you want to run the latest code directly from GitHub without cloning the repository locally, use `docker-compose.dev.yml`. This is useful for running RSVP to Me on any server with just Docker installed.

### Usage

```bash
# Download just the two files you need
mkdir rsvp-to-me && cd rsvp-to-me
curl -O https://raw.githubusercontent.com/joe-cole1/rsvp-to-me/main/docker-compose.dev.yml
curl -O https://raw.githubusercontent.com/joe-cole1/rsvp-to-me/main/.env.example
cp .env.example .env   # fill in your secrets

docker compose -f docker-compose.dev.yml up --build -d
```

To update to the latest code:

```bash
docker compose -f docker-compose.dev.yml up --build -d
```

---

## Step 5 — First Login and Admin Setup

1. Open your browser and go to the URL you configured in `NEXT_PUBLIC_APP_URL`.
2. Click **Sign In** and type the email address you put in `INITIAL_ADMIN_EMAIL`.
3. Check your email inbox for the magic link. Click it to log in.
   - _Note: If email is not yet configured, extract the link manually from the logs:_
     ```bash
     docker compose logs app | grep "magic link"
     ```
4. Once logged in, go to the `/admin` URL in your browser to confirm you have access to the Admin Panel.

---

## Understanding Your Data & Backups

By default, the application uses a **bind mount** — a Docker feature that links a folder on your host machine to a folder inside the container so the data survives restarts and upgrades. Here, the local `./data` directory is linked to `/app/data` inside the containers.

Your data is stored in these paths:

- **`./pg_data/`**: PostgreSQL data directory containing all users, events, RSVPs, comments, polls, and potlucks.
- **`./data/uploads/`**: Uploaded cover images and profile avatars.
- **`./data/backups/`**: Database backup files (`.sql` dumps from `pg_dump`).

### Built-in Backups Manager (Recommended)

**RSVP to Me** features a database backup manager located in the **Backups** tab in the **Admin Panel**.

With this panel, you can:

- **Configure automated backups:** Input a cron schedule (e.g. `0 0 * * *` for daily backups at midnight) to run backups automatically.
- **Adjust rotation limits:** Configure how many backups to keep (e.g. 7) before older files are deleted.
- **Trigger manual backups:** Immediately execute `pg_dump` to create a backup.
- **Download & Delete backups:** View all archives, download them directly, or delete them from the server.

### Manual Backups

Use `pg_dump` via the postgres container to create a backup at any time:

**Backup Command (Linux/Mac/Windows):**

```bash
docker compose exec postgres pg_dump -U postgres rsvp_db > ./data/backups/manual-backup-$(date +%Y%m%d).sql
```

> **Caution:** Running `docker compose down -v` deletes all Docker volumes. While RSVP to Me uses a local directory bind mount, running this with custom setups might lead to permanent data loss. Always omit the `-v` flag to protect your data.

---

## Stopping, Starting, and Restarting

Manage your containers using these CLI commands:

- **`docker compose stop`**: Gracefully stops the running application. Your data remains perfectly safe.
- **`docker compose start`**: Starts the stopped application.
- **`docker compose restart`**: Restarts the container (useful after making small modifications).
- **`docker compose down`**: Stops and removes the application container. The `./data` directory on the host remains intact.

---

## HTTPS and Custom Domains

Next.js session cookies rely on secure contexts. Browsers will block authentication cookies over unencrypted HTTP on public domains. **HTTPS is required for internet-facing installations.**

You do not configure HTTPS inside RSVP to Me. Instead, run a **reverse proxy** in front of port `3000` to handle SSL certificates (like Let's Encrypt) and forward traffic.

Recommended reverse proxies:

- **Caddy** (Automatic HTTPS, simple single-line reverse proxies): [Caddy Reverse Proxy Quick Start](https://caddyserver.com/docs/quick-starts/reverse-proxy)
- **Nginx Proxy Manager** (Web-based GUI for managing Let's Encrypt certificates): [Nginx Proxy Manager Homepage](https://nginxproxymanager.com/)
- **Traefik** (A cloud-native proxy that integrates directly with Docker labels): [Traefik Docker Documentation](https://doc.traefik.io/traefik/)

---

## Troubleshooting

### The app won't start

Run `docker compose logs app` to inspect the logs.

- If you see `SESSION_SECRET must be at least 32 characters`, make sure you generated a long random string.
- If you see `DATABASE_URL is required` or `REDIS_URL is required`, ensure both are set in your `.env` file.
- If you see connection errors to Postgres or Redis, ensure both containers are healthy: `docker compose ps`.
- If port `3000` is already in use by another app, open `docker-compose.yml` and change `"3000:3000"` to `"3001:3000"` (or another available port).

### I didn't receive a magic link email

1. If you haven't configured SMTP or Cloudflare credentials yet, retrieve the magic link directly from the logs: `docker compose logs app | grep "magic link"`.
2. Check your spam folder.
3. If configured, go to `/admin` > **System Configuration** > **Send Test Email** to check for configuration errors.

### I lost my administrator access

Ensure `INITIAL_ADMIN_EMAIL="your-email@domain.com"` is set in `.env`, then run:

```bash
docker compose restart app
```

Log out of the application, then log back in using that email address to re-trigger the Admin promotion logic.
