# Admin Panel Guide

The Admin Panel gives you a complete view of your rsvp-to-me installation: every user account, every event page, system configuration, and invite codes. This guide explains what each section does and how to use it.

---

## Table of Contents

1. [Accessing the Admin Panel](#accessing-the-admin-panel)
2. [Getting Admin Access](#getting-admin-access)
3. [Dashboard Overview](#dashboard-overview)
4. [User Management](#user-management)
5. [Event Management](#event-management)
6. [System Configuration](#system-configuration)
   - [Email Settings](#email-settings)
   - [SMS Settings](#sms-settings)
   - [Registration Settings](#registration-settings)
7. [Invite Code Management](#invite-code-management)
8. [Database Backup Management](#database-backup-management)
9. [Admin Security Notes](#admin-security-notes)

---

## Accessing the Admin Panel

Navigate to `/admin` on your installation in your browser:
- Local address: `http://localhost:3000/admin`
- Domain address: `https://rsvp.yourdomain.com/admin`

The Admin Panel is strictly gated to users with the `ADMIN` role. If you attempt to access `/admin` with a lower-privilege account, the app will redirect you to the main dashboard.

---

## Getting Admin Access

There are two methods to promote your account to Admin:

### Method 1: INITIAL_ADMIN_EMAIL (First-Time Setup)
Set the `INITIAL_ADMIN_EMAIL` environment variable in your `.env` file to your email address and restart the application.
```env
INITIAL_ADMIN_EMAIL="youraddress@domain.com"
```
```bash
docker compose restart app
```
The first time you sign in using this email, your account is automatically promoted to `ADMIN` in the database.

### Method 2: Promotion via the Admin Panel
If you already have one active Admin account, you can promote other users:
1. Navigate to `/admin` > **Users**.
2. Search for the user by name or email address.
3. Click on the user's row to open their profile details.
4. Select `ADMIN` from the **Role** dropdown menu.
5. Click **Save Changes**.

---

## Dashboard Overview

The Admin dashboard home screen shows a summary of your installation stats:

| Stat | What it counts |
|------|---------------|
| **Total Users** | All registered guest and host accounts in the database. |
| **Total Events** | Every event page created (drafts, published, and cancelled). |
| **Total RSVPs** | The sum of all RSVPs submitted by guests across all events. |
| **Check-ins** | Total guests marked as checked in by hosts on event days. |
| **Invite Codes** | The number of active registration invite codes. |

---

## User Management

Go to `/admin` > **Users** to view and manage accounts.

### Searching Users
Filter the list by entering a search query at the top. The table searches across user display names, email addresses, and phone numbers.

### User Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| `GUEST` | Basic guest account. | Can RSVP, reply to update blasts, post comments, claim potluck items, and vote in polls. Cannot host events. |
| `HOST` | Standard event organizer. | All guest actions, plus: create event pages, manage guest lists, send blast updates, invite guests, and manage co-hosts. |
| `ADMIN` | System administrator. | All host actions, plus: access the Admin Panel, search and moderate all events, delete accounts, and configure system settings. |

### Deleting a User
You can delete any user from the user detail view.
- **What is deleted:** The user's account details (name, email, phone) and active sessions (they are logged out immediately).
- **What is NOT deleted:** Events they created (remains on the server, but host is unlinked), RSVPs they submitted, and comments they wrote (remains under their name).

> **Warning:** User deletion is permanent and takes effect immediately. Ensure you intend to delete the account before clicking the delete button.

### User Notification Preferences
Admins can inspect whether users have Email Notifications or SMS Notifications toggled on or off in their detail view. Admins cannot change these preferences on behalf of users.

---

## Event Management

Go to `/admin` > **Events** to inspect event pages across your installation.

### Search and Moderation
Search for events using the event title, slug, or the host's email. You can filter the table by status (Draft, Published, Cancelled).

### What Admins Can Do
- Admins can view any event page details and view guest lists.
- Admins cannot edit event details directly inside the Admin Panel. However, when an Admin navigates to a public event page, their permissions supersede host checks, allowing them to use the inline editor, manage comments, edit potlucks, and moderate RSVPs just like the host.

---

## System Configuration

Go to `/admin` > **System Configuration** to manage credentials. Settings saved here are stored in the database and override the values defined in your `.env` file immediately without needing a container restart.

---

### Email Settings
You can configure and switch email delivery options in the UI.

- **Email Provider:** Dropdown to select SMTP, Cloudflare Workers, or Cloudflare REST API.
- **SMTP Fields:** Enter Host, Port, secure settings, SMTP username, SMTP password, and the From Address.
- **Test Email:** Input an email address and click **Send Test Email** to verify settings.

---

### SMS Settings
Enter your Twilio Account SID, Auth Token, and phone number.
- Click **Send Test SMS** to send a test message to a phone number.

---

### Registration Settings
- **Open Registration Toggle:** Turn on to allow anyone to register as a host. Turn off to force new hosts to provide an active invite code.

---

## Invite Code Management

Go to `/admin` > **Invite Codes** to manage Host registration codes.

### Creating an Invite Code
Click **Create New Code** and configure the fields:
- **Code:** Type a custom string. Leave blank to let the system generate a random code.
- **Note:** Add a description (e.g. "For Book Club").
- **Max Uses:** Limit the number of times the code can be redeemed.
- **Expires At:** Set an optional date after which the code is disabled.

### Managing Codes
Click the status toggle next to any code in the table to instantly deactivate or reactivate it.

### Env-Var Code vs. Admin Panel Codes

| Feature | `HOST_INVITE_CODE` (env var) | Admin Panel codes |
|---------|------------------------------|-------------------|
| **Location** | Defined in `.env` file | Stored in SQLite database |
| **Expiration** | None (always active) | Optional expiration date |
| **Usage Limits** | Unlimited | Optional max usage count |
| **Quantity** | Exactly one code | Multiple unique codes |

---

## Database Backup Management

Go to `/admin` > **Database Backups** to manage database snapshots. This system supports SQLite file clones and PostgreSQL `pg_dump` backups, saving them directly to the persistent `/app/data/backups` volume.

### Backup Configuration
You can configure automated database backup properties:
*   **Backup Cron Schedule:** Configure automated backup intervals using standard 5-field cron syntax (e.g. `0 0 * * *` for daily at midnight). Set to `disabled` to deactivate scheduled backups.
*   **Backups to Retain:** Set the retention limit (rotation count). When a new backup runs, the system automatically checks this limit and deletes the oldest backup files to keep disk usage under control.

### Manual Actions
*   **Create Backup Now:** Trigger an immediate database snapshot. SQLite will duplicate the database file, while PostgreSQL will run a `pg_dump` operation.
*   **Download Backups:** Click **Download** next to any archive in the list. This streams the file directly to your browser via a secure, admin-authenticated route.
*   **Delete Backups:** Click **Delete** next to any file to permanently purge the backup from the server's disk storage.

---

## Admin Security Notes

- Stored credentials (SMTP password, Twilio Auth Token, Cloudflare API Token) are AES-256-GCM encrypted in the SQLite database using the `ENCRYPTION_KEY` (or `SESSION_SECRET` as a fallback) to prevent exposure during database leak events.
- Sensitive values are masked (as `••••••••`) before being sent to the browser.
- There is no separate administrator password. Admin accounts are accessed via the same secure passwordless magic link flow as regular users.
- Actions taken within the Admin Panel are not currently logged in the public activity feed.
