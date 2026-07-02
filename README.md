# RSVP to Me

A beautiful, self-hosted, social-first event and RSVP platform for personal events (house parties, wine nights, dinners). Inspired by Partiful's expressive aesthetic. No payments, no ticketing — just invite links, RSVPs, connection, and social coordination.

## Core Features

- **Beautiful Themes**: Dark, Soft, and Bold templates with custom accent colors and cover image uploads.
- **Passwordless Authentication**: Login securely via email or SMS magic links — no passwords to remember.
- **Guest Coordination**: Threaded comment sections, interactive polls, co-hosts, and potluck claim tracking.
- **Custom Questionnaires**: Add custom text, select, or checkbox questions directly to the RSVP form.
- **Automated Reminders**: Schedule email or text reminders for guests 7 days, 1 day, or N hours before the event.
- **Admin Control Panel**: Manage all users, events, custom invite codes, and system configurations easily.

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
   curl -O https://raw.githubusercontent.com/joe-cole1/rsvp-to-me/main/docker-compose.yml
   curl -O https://raw.githubusercontent.com/joe-cole1/rsvp-to-me/main/.env.example
   ```

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
   - `POSTGRES_PASSWORD` and `REDIS_PASSWORD`: Strong passwords for the bundled database and cache containers. Docker Compose uses these to run PostgreSQL/Redis and to build the app's connection URLs. Both are required — there are no default passwords, and `docker compose up` fails fast if either is unset.
   - `SESSION_SECRET`: A secure, random string (at least 32 characters) used to encrypt cookies. You can generate one with the command `openssl rand -base64 32` or via [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32).
   - `NEXT_PUBLIC_APP_URL`: The URL where guests will visit your app (e.g. `http://localhost:3000` or `https://rsvp.yourdomain.com`). No trailing slash.
   - `INITIAL_ADMIN_EMAIL`: Your email address. When you log in with this email, your account is promoted to Administrator.
   - `HOST_INVITE_CODE`: A code used to restrict host registration to people you know. The example ships an obvious placeholder that the app rejects at startup in production — replace it with a strong value (e.g. `openssl rand -hex 8`).

4. **Start the application**
   Run the following command in the same directory as your `docker-compose.yml` to pull images and start the services:

   ```bash
   docker compose up -d
   ```

5. **Verify the container logs**
   Check the web server logs to make sure the app started successfully:

   ```bash
   docker compose logs -f app
   ```

   Press `Ctrl+C` to exit the logs view once you see `▲ Next.js ready on http://0.0.0.0:3000`.

6. **Log in and configure Admin Access**
   - Open your browser and navigate to the URL you configured in `NEXT_PUBLIC_APP_URL`.
   - Click **Sign In** and log in using the email address you set in `INITIAL_ADMIN_EMAIL`.
   - Check your inbox for the login email. Click the link to log in. _(If email is not set up, run `docker compose logs app | grep "magic link"` to extract the login link manually from the container logs)._
   - Once logged in, visit `/admin` to verify that you have admin access.

---

## Detailed Documentation Guides

For in-depth explanations of specific features, configurations, and operations, refer to the guides below:

| Guide                                                  | Description                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [Installation Guide](docs/admin/installation.md)       | Full setup walkthrough, Docker setup, data backups, and HTTPS reverse proxies.            |
| [Configuration Reference](docs/admin/configuration.md) | Comprehensive list and explanation of every environment variable.                         |
| [Email Setup Guide](docs/admin/email.md)               | Setting up SMTP (Gmail, Outlook, SES, etc.) or Cloudflare Email Routing.                  |
| [SMS Setup Guide](docs/admin/sms.md)                   | Connecting Twilio to enable text message logins, invitations, and blasts.                 |
| [Admin Panel Guide](docs/admin/admin.md)               | Managing user accounts, event moderation, custom invite codes, and system configurations. |
| [Host Guides](docs/host/)                              | Step-by-step guides for event hosts: creating events, RSVPs, invitations, and more.       |
| [Safe Upgrading Guide](docs/admin/upgrading.md)        | Instructions on updating to new versions safely without losing any database data.         |
