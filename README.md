# RSVP to Me

A beautiful, self-hosted, social-first event and RSVP platform for personal events (house parties, wine nights, dinners). Inspired by Partiful's expressive aesthetic. No payments, no ticketing — just invite links, RSVPs, connection, and social coordination.

[Screenshots](#screenshots) · [Features](#core-features) · [Quick Start](#quick-start) · [Host Guide](docs/host/getting-started.md) · [Admin Guide](docs/admin/installation.md) · [Releases](https://github.com/joe-cole1/rsvp-to-me/releases)

## Screenshots

### Guest event page

> **Screenshot coming soon: Guest event page.** A themed invitation with a cover image, event details, and RSVP controls.

<!-- Screenshot placeholder: event-guest-view.png. Replace the blockquote with the supplied desktop screenshot and descriptive alt text. -->

### Host dashboard

> **Screenshot coming soon: Host dashboard.** Upcoming events with cover images, attendance counts, and host navigation.

<!-- Screenshot placeholder: host-dashboard.png. Replace the blockquote with the supplied desktop screenshot and descriptive alt text. -->

Explore [guest management](docs/host/guest-list.md#guest-management-preview) and [theme customization](docs/host/customizing-your-page.md#theme-customization-preview) in the host guides.

## How It Works

1. **Create an event:** Set the title, date, time, and location.
2. **Make it yours:** Choose a theme, add a cover image, and set visibility and RSVP options.
3. **Invite your guests:** Share the event link or send email and optional SMS invitations.
4. **Manage the gathering:** Track responses, coordinate food and plans, send updates, and check guests in.

**Hosts** sign in with a magic link. **Guests** can RSVP without creating an account and use their personal edit link to update their response while changes are allowed. Private events still require the appropriate invitation or access. See the [Host Guide](docs/host/getting-started.md) for the full workflow.

## Core Features

### Make each event your own

- **Themes and covers:** Dark, Soft, and Bold base themes, seasonal presets, custom colors, and cover image uploads.
- **Fonts and effects:** Event-title fonts and optional animated backgrounds, with matching static email styling.
- **Privacy controls:** Public, unlisted, and private events, password protection, and guest-list visibility settings.

### Keep guests connected

- **Simple RSVPs:** Going, Maybe, or No responses, plus-ones, approval rules, capacity limits, and custom questionnaires.
- **Shared planning:** Threaded comments, interactive polls, and potluck claims.
- **Invitations and updates:** Email invitations, automatic reminders, host messages, and optional Twilio SMS.

### Give hosts the tools they need

- **Passwordless access:** Email or optional SMS magic links, plus co-host support.
- **Guest management:** Search and filter responses, check in parties, add walk-ins, and export the guest list and questionnaire answers to CSV.
- **Administration:** Manage users, events, host invite codes, and system configuration from the Admin Control Panel.

## Before You Install

| Requirement               | What to expect                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Docker and Docker Compose | The release Compose file runs the app with PostgreSQL and Redis; you do not need to install Node.js on the host.                 |
| A reachable app URL       | Use localhost for a local trial, or a stable URL reachable by your guests for a shared deployment.                               |
| Email delivery            | Configure SMTP or a supported Cloudflare provider before production sign-in. Production images do not print magic links in logs. |
| SMS (optional)            | Connect Twilio if you want text-message sign-in, invitations, or updates.                                                        |

For a populated local test instance, see [Sample Data and Screenshots](docs/admin/sample-data.md). It explains the seeded accounts and development sign-in workflow.

---

## Quick Start

This section gets your **RSVP to Me** installation up and running in a few steps. For the full guide, see [docs/admin/installation.md](docs/admin/installation.md).

### Prerequisites

- [Docker and Docker Compose](https://docs.docker.com/compose/install/) installed on your machine.
- A stable URL or IP address (e.g., `http://localhost:3000` or `https://rsvp.yourdomain.com`) where you and your guests can reach the application.

### Step-by-Step Setup

1. **Get the files**
   Open a terminal and run the following command to download the required deployment files:

   ```bash
   mkdir rsvp-to-me && cd rsvp-to-me
   curl -fLO https://raw.githubusercontent.com/joe-cole1/rsvp-to-me/main/docker-compose.release.yml
   curl -fLO https://raw.githubusercontent.com/joe-cole1/rsvp-to-me/main/.env.example
   ```

   Use `docker-compose.release.yml` explicitly even if you cloned the repository.
   The root `docker-compose.yml` builds from source, and its automatic override
   is for native development.

2. **Create your configuration file**
   Create a `.env` file by copying the example template:
   - **Linux/Mac (Terminal):**
     ```bash
     cp .env.example .env
     ```
   - **Windows (PowerShell):**
     ```powershell
     Copy-Item .env.example .env
     ```

3. **Configure the minimum required values**
   Open the `.env` file in your preferred text editor (like Notepad on Windows or Nano on Linux/Mac) and configure these variables:
   - `POSTGRES_PASSWORD` and `REDIS_PASSWORD`: Strong passwords for the bundled database and cache containers. Docker Compose uses these to run PostgreSQL/Redis and to build the app's connection URLs. Both are required — there are no default passwords, and `docker compose -f docker-compose.release.yml up` fails fast if either is unset.
   - `SESSION_SECRET`: A secure, random string (at least 32 characters) used to encrypt cookies. You can generate one with the command `openssl rand -base64 32` or via [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32).
   - `NEXT_PUBLIC_APP_URL`: The URL where guests will visit your app (e.g. `http://localhost:3000` or `https://rsvp.yourdomain.com`). No trailing slash.
   - `INITIAL_ADMIN_EMAIL`: Your email address. When you log in with this email, your account is promoted to Administrator.
   - Configure SMTP or the optional email worker using the [Email Setup Guide](docs/admin/email.md) before your first sign-in. Production images do not print magic links in logs.
   - `HOST_INVITE_CODE`: A code used to restrict host registration to people you know. The example ships an obvious placeholder that the app rejects at startup in production — replace it with a strong value (e.g. `openssl rand -hex 8`).

4. **Start the application**
   Run the following command in the same directory as your `docker-compose.release.yml` to pull images and start the services:

   ```bash
   docker compose -f docker-compose.release.yml up -d
   ```

5. **Verify the container logs**
   Check the web server logs to make sure the app started successfully:

   ```bash
   docker compose -f docker-compose.release.yml logs -f app
   ```

   Press `Ctrl+C` to exit the logs view once you see `▲ Next.js ready on http://0.0.0.0:3000`.

6. **Log in and configure Admin Access**
   - Open your browser and navigate to the URL you configured in `NEXT_PUBLIC_APP_URL`.
   - Click **Sign In** and log in using the email address you set in `INITIAL_ADMIN_EMAIL`.
   - Check your inbox for the login email. Click the link to log in.
   - Once logged in, visit `/admin` to verify that you have admin access.

---

## Detailed Documentation Guides

For in-depth explanations of specific features, configurations, and operations, refer to the guides below:

| Guide                                                    | Description                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Installation Guide](docs/admin/installation.md)         | Full setup walkthrough, Docker setup, data backups, and HTTPS reverse proxies.              |
| [Configuration Reference](docs/admin/configuration.md)   | Comprehensive list and explanation of every environment variable.                           |
| [Email Setup Guide](docs/admin/email.md)                 | Setting up SMTP (Gmail, Outlook, SES, etc.) or Cloudflare Email Routing.                    |
| [SMS Setup Guide](docs/admin/sms.md)                     | Connecting Twilio to enable text message logins, invitations, and blasts.                   |
| [Admin Panel Guide](docs/admin/admin.md)                 | Managing user accounts, event moderation, custom invite codes, and system configurations.   |
| [Host Guides](docs/host/)                                | Step-by-step guides for event hosts: creating events, RSVPs, invitations, and more.         |
| [Safe Upgrading Guide](docs/admin/upgrading.md)          | Instructions on updating to new versions safely without losing any database data.           |
| [Sample Data and Screenshots](docs/admin/sample-data.md) | Seeded test accounts, local sign-in, and the desktop screenshot checklist.                  |
| [Architecture Map](ARCHITECTURE.md)                      | Developer map of runtime boundaries, subsystems, entry points, and common change locations. |
