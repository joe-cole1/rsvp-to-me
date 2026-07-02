---
title: Admin Panel
description: Admin walkthrough: users, system config, backups, themes.
category: Usage
audience: admin
order: 50
---

# Admin Panel Guide

The Admin Panel gives you a complete view of your RSVP to Me installation: every user account, every event page, system configuration, invite codes, themes, and backups. This guide explains what each section does and how to use it.

---

## Table of Contents

1. [Accessing the Admin Panel](#accessing-the-admin-panel)
2. [Getting Admin Access](#getting-admin-access)
3. [Overview](#overview)
4. [User Management](#user-management)
5. [Event Moderation](#event-moderation)
6. [Host Settings (Invite Codes & Registration)](#host-settings-invite-codes--registration)
7. [Email Settings](#email-settings)
8. [SMS Settings](#sms-settings)
9. [Database Backups](#database-backups)
10. [Theme Presets](#theme-presets)
11. [Admin Security Notes](#admin-security-notes)

---

## Accessing the Admin Panel

Navigate to `/admin` on your installation in your browser:

- Local address: `http://localhost:3000/admin`
- Domain address: `https://rsvp.yourdomain.com/admin`

The Admin Panel is strictly gated to users with the `ADMIN` role. If you attempt to access `/admin` with a lower-privilege account, the app redirects you to the main dashboard.

The panel is organized into a sidebar of tabs (a slide-in drawer on mobile): **Overview**, **Users**, **Events**, **Host Settings**, **Email**, **SMS**, **Backups**, **Themes**, and **Documentation**. The active tab is reflected in the URL (e.g. `/admin?tab=backups`), so you can bookmark or refresh without losing your place.

> **Tip:** All of these admin guides — this one plus installation, configuration, email, SMS, and upgrading — are also readable inside the app in the **Documentation** tab at the bottom of the Admin Panel menu.

---

## Getting Admin Access

There are two ways to promote an account to Admin.

### Method 1: INITIAL_ADMIN_EMAIL (First-Time Setup)

Set the `INITIAL_ADMIN_EMAIL` environment variable in your `.env` file to your email address and restart the application.

```env
INITIAL_ADMIN_EMAIL="youraddress@domain.com"
```

```bash
docker compose restart app
```

The first time you sign in using this email, your account is automatically promoted to `ADMIN` (provided there are currently no other administrators in the system). This is a bootstrap mechanism for first-time installation.

### Method 2: Promotion via the Admin Panel

If you already have one active Admin account, you can promote other users:

1. Navigate to `/admin` > **Users**.
2. Search for the user by name or email address.
3. Click the user's row to open their details.
4. Select `ADMIN` from the **Role** dropdown.
5. Save the change.

---

## Overview

The **Overview** tab shows a snapshot of your installation:

| Stat             | What it counts                                              |
| ---------------- | ----------------------------------------------------------- |
| **Total Users**  | All registered guest, host, and admin accounts.             |
| **Total Events** | Every event page created (published and cancelled).         |
| **Total RSVPs**  | The sum of all RSVPs submitted by guests across all events. |
| **Check-ins**    | Total guest check-in records stored in the database.        |
| **Invite Codes** | The number of active host-registration invite codes.        |

---

## User Management

Go to `/admin` > **Users** to view and manage accounts.

### Searching Users

Filter the list by entering a search query at the top. The table searches across display names, email addresses, and phone numbers.

### Creating a User

Click **+ Create User** to open the creation modal and fill in:

- **Name**, **Email**, and (optionally) **Phone** — email and phone must be unique.
- **Role** — `GUEST`, `HOST`, or `ADMIN`.

When you create the user, a 48-hour magic sign-in link is emailed to them so they can log in immediately. If email delivery fails, the account is still created — the email step is non-blocking.

### User Roles

| Role    | Description               | Capabilities                                                                                                                    |
| ------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `GUEST` | Basic guest account.      | Can RSVP, reply to update blasts, post comments, claim potluck items, and vote in polls. Cannot host events.                    |
| `HOST`  | Standard event organizer. | All guest actions, plus: create event pages, manage guest lists, send blast updates, invite guests, and manage co-hosts.        |
| `ADMIN` | System administrator.     | All host actions, plus: access the Admin Panel, search and moderate all events, delete accounts, and configure system settings. |

> **Co-hosts:** a host can appoint other registered users as co-hosts of an individual event. Co-hosts are not a separate role — they get per-event management rights equivalent to the host's (edit event details, theme, cover image, settings and reminders; manage RSVPs, guest list, potluck, polls, questionnaire fields; send email/SMS blasts and updates; invite guests) with two exceptions that stay with the original host: **deleting the event** and **adding/removing co-hosts**. Server actions enforce this uniformly via a shared authorization check (SEC-30).

### Deleting and Restoring Users

You can delete and manage users from the **Users** tab.

- **Standard Deletion (Grace Period)**: By default, deleting a user schedules their account to be permanently deleted and anonymized in 30 days. During this 30-day grace period, the user's account is suspended, but an admin can click **Restore** to cancel the deletion request and re-enable the account.
- **Immediate Deletion Override**: Admins can bypass the 30-day grace period and immediately anonymize/delete a pending user by clicking **Delete Now** in the user's action column (requires confirmation).
- **Self-Service Revocation**: If a host schedules their own account for deletion from their Profile settings page, they can cancel the deletion request from the same page at any time during the 30-day window.
- **Anonymization Details**: When deletion becomes final (or is done immediately), the user's PII is permanently anonymized: their name is changed to "Deleted User", email and phone are set to `null`, and any custom avatar is removed. The role is reset to `GUEST`. Their guest RSVPs on other events, co-host slots, magic tokens, and active sessions are fully deleted.
- **Event Reassignment**: Events created by the deleted user are not deleted. Instead, they are reassigned to the `"system"` tombstone user account so that guests can still access them and view details.

### Filtering Users

The **Users** list can be filtered using the dropdown selectors:

- **Role Filter**: Filter users by account type (`All Roles`, `ADMIN`, `HOST`, `GUEST`).
- **Status Filter**: Filter users by account state (`All Statuses`, `Active`, `Pending Deletion`).

---

## Event Moderation

Go to `/admin` > **Events** to inspect event pages across your installation.

### Search and Moderation

Search for events by title, slug, or the host's email, and filter by status.

### What Admins Can Do

- View any event's details and guest list, and delete events that violate your rules.
- Admins do not edit event details from inside the Admin Panel. Instead, when an Admin opens a public event page, their permissions supersede the host checks — so they can use the inline editor, manage comments, edit potlucks, and moderate RSVPs exactly like the host.

---

## Host Settings (Invite Codes & Registration)

Go to `/admin` > **Host Settings** to control how new hosts join the platform.

### Open Registration

- **Open Registration toggle:** turn on to let anyone register as a host without a code. Turn off to require a valid invite code at registration.

### Creating an Invite Code

When open registration is off, hosts need an invite code. Click **Create New Code** and configure:

- **Code:** type a custom string, or leave blank to generate a random one.
- **Note:** a description (e.g. "For Book Club").
- **Max Uses:** limit how many times the code can be redeemed.
- **Expires At:** an optional date after which the code stops working.

### Managing Codes

Toggle the status next to any code in the table to deactivate or reactivate it instantly.

### Env-Var Code vs. Admin Panel Codes

| Feature          | `HOST_INVITE_CODE` (env var) | Admin Panel codes        |
| ---------------- | ---------------------------- | ------------------------ |
| **Location**     | Defined in `.env` file       | Stored in the database   |
| **Expiration**   | None (always active)         | Optional expiration date |
| **Usage Limits** | Unlimited                    | Optional max usage count |
| **Quantity**     | Exactly one code             | Multiple unique codes    |

---

## Email Settings

Go to `/admin` > **Email** to configure outbound email. Settings saved here are stored in the database and override the matching `.env` values immediately, without a container restart.

- **Guest Email Notifications toggle:** when off, no emails are sent to guests (RSVP confirmations, blast updates, reminders, invites). Host sign-in links and admin emails are always sent regardless of this setting.
- **Email Provider:** choose **SMTP**, **Cloudflare Worker**, or **Cloudflare REST API**.
- **Provider fields:** enter the credentials for the selected provider (SMTP host/port/secure/username/password, or the relevant Cloudflare fields) plus the **From Address**.
- **Send Test Email:** enter an address and send a test to verify your settings.

See the [Email Setup Guide](email.md) for provider-by-provider walkthroughs.

---

## SMS Settings

Go to `/admin` > **SMS** to configure Twilio.

- **SMS Notifications toggle:** when on, guests receive SMS confirmations, blast updates, reminders, and invites. It defaults to on automatically when Twilio credentials are present, and requires those credentials to work.
- Enter your Twilio **Account SID**, **Auth Token**, and **phone number**.
- **Send Test SMS:** send a test message to a phone number to verify your settings.

See the [SMS Setup Guide](sms.md) for the full Twilio walkthrough.

---

## Database Backups

Go to `/admin` > **Backups** to manage PostgreSQL database snapshots. Backups are created with `pg_dump` and saved to the persistent `/app/data/backups` volume.

### Backup Schedule

Pick a schedule from the preset dropdown: **Disabled**, **Every hour**, **Every 6 hours**, **Daily at midnight**, **Every 3 days**, **Weekly**, or **Custom**. Choosing **Custom** reveals a field for a standard 5-field cron expression (e.g. `0 0 * * *` for daily at midnight).

- **Backups to Retain:** set how many snapshots to keep. When a new backup runs, the oldest files beyond this limit are deleted automatically to control disk usage.

### Manual Actions

- **Create Backup Now:** trigger an immediate `pg_dump` snapshot.
- **Download:** stream any archive to your browser via a secure, admin-authenticated route.
- **Delete:** permanently remove a backup file from disk.

---

## Theme Presets

Go to `/admin` > **Themes** to manage the preset themes hosts can choose from in their event settings.

- **Create / Edit / Delete presets:** configure a preset's base style, accent colors, gradients, decorations, title, and description.
- **Active vs. inactive:** inactive presets are hidden from hosts but kept for later use.

These presets populate the theme picker that hosts see when customizing an event page.

---

## Admin Security Notes

- Stored credentials (SMTP password, Twilio Auth Token, Cloudflare API token/secret) are AES-256-GCM encrypted in the database using the `ENCRYPTION_KEY` (falling back to `SESSION_SECRET` if it is not set), to limit exposure if the database is ever leaked.
- Sensitive values are masked (as `••••••••`) before being sent to the browser.
- There is no separate administrator password. Admin accounts sign in through the same passwordless magic-link flow as everyone else.
- Actions taken within the Admin Panel are not currently recorded in the public activity feed.
