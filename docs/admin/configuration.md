---
title: Configuration
description: Environment variable reference for every subsystem.
category: Configuration
audience: admin
order: 20
---

# Configuration Reference

All configurable settings for **RSVP to Me** live in a single `.env` file in the same directory as your `docker-compose.yml`. This guide explains every variable, what it controls, and how to configure it.

---

## Table of Contents

1. [How Configuration Works](#how-configuration-works)
2. [Core Application Settings](#core-application-settings)
   - [DATABASE_URL](#database_url)
   - [SESSION_SECRET](#session_secret)
   - [ENCRYPTION_KEY](#encryption_key)
   - [NEXT_PUBLIC_APP_URL](#next_public_app_url)
   - [Cloudflare Turnstile](#cloudflare-turnstile)
   - [INITIAL_ADMIN_EMAIL](#initial_admin_email)
   - [OPEN_REGISTRATION](#open_registration)
   - [HOST_INVITE_CODE](#host_invite_code)
   - [SEED_TEST_DATA](#seed_test_data)
   - [LOG_LEVEL](#log_level)
3. [Email Configuration](#email-configuration)
   - [EMAIL_FROM](#email_from)
   - [SMTP Settings](#smtp-settings)
   - [Cloudflare Worker Email](#cloudflare-worker-email)
   - [Cloudflare REST API Email](#cloudflare-rest-api-email)
   - [INBOUND_FORWARD_TO](#inbound_forward_to)
4. [SMS Configuration (Twilio)](#sms-configuration-twilio)
5. [PostgreSQL Configuration](#postgresql-configuration)
6. [Redis Configuration](#redis-configuration)
7. [Database Backup Configuration](#database-backup-configuration)
8. [Quick Reference Table](#quick-reference-table)

---

## How Configuration Works

When Docker Compose starts your containers, it loads the `.env` file and passes the variables to the `app` service.

Most changes to `.env` require a restart to take effect:

```bash
docker compose restart
```

> **Security:** Your `.env` file contains sensitive secrets. Never check it into a git repository.

### Environment loading for commands

Prisma commands, database seeding, startup migrations, and tests use dotenv
18.0.4 to load `.env` from the project directory. With the default loader
options, values already supplied by Docker Compose or the shell take precedence
over values in that file. The existing `.env` and Compose setup needs no changes.

The `dotenv/config` import used by Prisma and seeding still loads the file and
is quiet by default. Direct `dotenv.config()` calls, including startup
migrations, write an informational `◇ injected env` message to stderr. Set
`DOTENV_QUIET=true` in the shell to suppress it, or `DOTENV_QUIET=false` to enable
the message for imports. The legacy `DOTENV_CONFIG_QUIET` environment variable
also works.

For custom commands, dotenv 18 removes encrypted `.env.vault` loading through
`DOTENV_KEY` and the old `dotenv_config_*` command-line arguments. Use the
documented plain `.env` setup; select a custom file with `DOTENV_PATH` (or
`DOTENV_CONFIG_PATH`) in the shell or an explicit `config({ path: ... })` call.
Explicit configuration options take precedence over environment options, and
`DOTENV_*` names take precedence over their `DOTENV_CONFIG_*` aliases. The
classic parser remains the default; this project does not enable the optional
fast parser.

### Settings Priority

Some configuration fields (email provider settings, registration mode) can also be changed at runtime via the Admin Panel. When a value is set in **both** the `.env` file and the database via the Admin Panel, **the Admin Panel database value takes precedence**.

### Content Security Policy and request rendering

Each document request receives a fresh, unpredictable script nonce. The
application puts that same nonce in the request policy used by Next.js and in
the `Content-Security-Policy` response header, so framework scripts and
approved inline scripts can run while an injected inline script is rejected.
Cloudflare Turnstile remains an allowed script source when it is enabled.
The document base URL is pinned to the app origin so a hostile `<base>` element
cannot retarget nonce-authorized relative scripts.
Server-rendered wrappers pass the request nonce through `CaptchaProvider` to the
Turnstile script so optional bot protection uses the same document nonce.
Full-page responses use their request nonce; during client navigation, Next's
trusted loader may load Turnstile using the new response nonce, which
`strict-dynamic` permits without requiring it to match the original page nonce.

Because HTML and React Server Component responses contain a nonce for one
request, do not cache or replay those responses in a reverse proxy or CDN.
Static assets such as files under `public/` and `/_next/` can still use normal
asset caching.

Dynamic guest CSV (`/e/:slug/guests.csv`), calendar ICS
(`/e/:slug/calendar.ics`), and admin backup (`/api/admin/backups/:filename`)
downloads send `Cache-Control: private, no-store`, including denied and missing
responses. Configure reverse proxies and CDNs to honor these origin headers and
never store these downloads. Purge any copies already stored by a proxy or CDN
when applying this policy.

---

## Core Application Settings

### DATABASE_URL

- **Required**: Yes
- **Type**: String (PostgreSQL connection URL)

**What it does:** Connection string for the PostgreSQL 18 database. All user profiles, events, RSVPs, comments, polls, and potluck lists are stored here.

**Format:**

```env
DATABASE_URL="postgresql://username:password@hostname:5432/database_name"
```

**Docker Context:** When using `docker-compose.yml`, the app connects to the bundled `postgres` container. The `pg_data/` directory on your host persists the database across restarts.

> **Caution:** PostgreSQL 18 is required. The application will not start without a valid Postgres connection URL.

---

### SESSION_SECRET

- **Required**: Yes (the app will crash on startup if missing or too short)
- **Default**: _(none)_
- **Type**: Random string (at least 32 characters)

**What it does:** The master key used to sign and encrypt cookies generated by `iron-session`. Without it, cookies cannot be verified, preventing session hijacking.

**How to generate:**

- **Linux/Mac (Terminal):**
  ```bash
  openssl rand -base64 32
  ```
  Generates a cryptographically secure random 32-byte Base64 string.
- **Windows (PowerShell):**
  ```powershell
  [Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Max 256) }))
  ```
- **Web alternative:** Generate via [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32) or [random.org/passwords](https://www.random.org/passwords/?num=1&len=44&format=html).

> **Warning:** Changing this value will invalidate all active sessions immediately, logging out all currently signed-in users.

---

### TRUSTED_IP_HEADER

- **Required**: No
- **Default**: _(none)_
- **Type**: String (Header Name)

**What it does:** Names the one HTTP request header RSVP to Me trusts as the
client IP for abuse controls. It is a header name, not an IP address, CIDR list,
or proxy-hop count. Header names are case-insensitive. For a comma-separated
value the app uses the **last nonempty entry**, never the first. The app does not
automatically walk a chain of trusted proxies.

**When and why to set it:** Configure this for a public installation behind a
trusted HTTP reverse proxy, including Cloudflare or self-hosted Pangolin, after
verifying that the proxy sets the selected header from the visitor's connection
and that clients cannot bypass the proxy to reach the app. This enables IP limits
that catch one caller rotating email addresses, phone numbers or guest tokens.
A shared proxy/container address instead groups unrelated visitors into the same
quota. A client-controlled header lets an attacker invent fresh IPs to evade it.
Setting the variable alone does not authenticate a proxy or secure the origin.

Leave it unset for local development or direct access without a trusted proxy.
Forwarding headers are then ignored and **IP tiers are skipped**, rather than
turning loopback into one site-wide quota. Contact, account and token limits still
apply. Protection against callers rotating those identifiers is reduced; enable
bot protection and put a trusted proxy in front of a public installation. RSVPs
with no contact have no contact quota, so without trusted IP configuration their
anti-automation check depends on bot protection being enabled. Event password
attempts retain a deliberate **shared per-event** cap of 10 per 10 minutes in this
mode: one event's guests share it, but other events are independent. Registration
uses 3 attempts per normalized email per hour, not 3 registrations site-wide;
without the IP tier it does not bound invite-code guessing across many addresses.

#### Cloudflare example

For `visitor → Cloudflare proxy or Tunnel → RSVP to Me`, put this in the app's
`.env`:

```dotenv
TRUSTED_IP_HEADER=CF-Connecting-IP
```

Use a proxied DNS record (orange cloud) or Cloudflare Tunnel; DNS-only records do
not provide Cloudflare's HTTP headers. Cloudflare supplies `CF-Connecting-IP` on
origin requests. Preserve that header through any internal proxy. Disable any
rule that removes visitor IP headers. Prevent direct origin access: for example,
use a Tunnel with no public app listener, or firewall the origin to Cloudflare
and use authenticated origin access. Do not expose port 3000 publicly alongside
the protected hostname. See [Cloudflare's header reference](https://developers.cloudflare.com/fundamentals/reference/http-headers/)
and [origin protection guidance](https://developers.cloudflare.com/fundamentals/security/protect-your-origin-server/).

#### Self-hosted Pangolin example

For `visitor → your Pangolin/Traefik HTTP resource → Newt/private network → RSVP
to Me`, use the header Pangolin sets from the observed client connection. For a
single proxy path whose final `X-Forwarded-For` entry is the visitor, set:

```dotenv
TRUSTED_IP_HEADER=X-Forwarded-For
```

Point the Pangolin HTTP/HTTPS resource at the app's private address and port;
restrict the app listener to that private path. Verify that the last entry is
the visitor, not Traefik, Newt or another internal proxy. Additional proxies may
append their own peer address; the app will use that final entry and visitors
will share a quota. For that topology, have the trusted proxy overwrite a
single-address `X-Real-IP` with its verified visitor IP, preserve it on internal
hops, and set `TRUSTED_IP_HEADER=X-Real-IP`. Do not set a static IP header on a
resource or copy a browser-supplied header verbatim.

If Cloudflare fronts Pangolin, follow [Pangolin's Cloudflare proxy guide](https://docs.pangolin.net/self-host/advanced/cloudflare-proxy)
first. Its Badger middleware can extract Cloudflare's visitor address and set
`X-Real-IP`/`X-Forwarded-For` downstream. Once verified on the resource serving
RSVP to Me, use `TRUSTED_IP_HEADER=X-Real-IP`; alternatively preserve
`CF-Connecting-IP` across the entire restricted Cloudflare/Pangolin path and use
the Cloudflare example. Pangolin's `server.trust_proxy` setting configures
Pangolin itself; it does not configure RSVP to Me or change this app's last-entry
rule. Never enable blanket trust of forwarded headers from arbitrary peers.

#### Apply and verify

After editing `.env`, recreate the app container to load the new environment
(use your deployment's normal Compose files; a container restart alone does not
reload `env_file`). For the published-image deployment:

```bash
docker compose -f docker-compose.release.yml up -d --force-recreate app
```

For a native server, restart its process; for local development use
`scripts/dev-restart.sh`. Before relying on the limits, inspect the selected
header **at the app-side end of the proxy path**, using private proxy diagnostics
or a temporary local upstream; there is no public IP-debug endpoint in the app.
Use two devices on different networks and confirm different visitor addresses.
Send a request with a fabricated forwarding header through the public hostname
and confirm the trusted proxy overwrites it or appends the real visitor as the
last entry. Confirm direct origin connections are refused. Do not publish
request headers, session cookies or visitor addresses in diagnostics. A configured
but missing/empty header still resolves to loopback and shares the IP quota:
correct the proxy/header selection rather than raising the limits.

**Rate-limited surfaces** (windows start at the first attempt; later attempts,
including blocked retries, do not extend them in Redis or the database fallback):

| Surface                             | Always enforced                                                                                   | Additional tier when `TRUSTED_IP_HEADER` is set                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Magic-link sign-in                  | Per normalized email/phone: 5 per 10 minutes                                                      | Per IP: 20 per 10 minutes                                                 |
| Host registration                   | Per normalized email: 3 per hour                                                                  | Per IP: 3 per hour                                                        |
| New RSVP                            | Per supplied normalized email and phone: 15 per 10 minutes overall and 8 per event per 10 minutes | Per IP: 15 per 10 minutes overall and 8 per event per 10 minutes          |
| Event password                      | Without trusted IP: shared per-event cap of 10 per 10 minutes                                     | With trusted IP: 10 per event + IP per 10 minutes replaces the shared cap |
| Host guest invitations              | Per host + event: 10 per hour; max 200 recipients per request                                     | Per IP: 15 per hour                                                       |
| Guest invitations on private events | Per guest token: 10 per 10 minutes; per inviting RSVP: 20 per day                                 | Per IP: 30 per hour                                                       |
| Notification destination proofs     | Per owner and per normalized destination: 5 per hour; minimum 60 seconds between owner requests   | Per IP: 5 per hour                                                        |

**Code verification (`signin-code`):** Always limited to 10 attempts per normalized email/phone per 10 minutes (`id:<identifier>:signin-code`). The additional `ip:<ip>:signin-code` bucket allows 20 per 10 minutes only when `TRUSTED_IP_HEADER` is configured (SEC-45). Each token also allows at most five incorrect attempts, then retires both code and link. Codes and links share a 15-minute expiry and single-use state; resend invalidates previous tokens. These limits also apply to verification after registration. Administrator-created welcome links remain link-only with a 48-hour expiry.

> **No account enumeration (SEC-40):** The sign-in screen shows the same "check your inbox" confirmation whether or not the identifier has an account — it never reveals which emails or phone numbers are registered. Self-hosters diagnosing a missing link should check the mail/SMS logs (look for `[auth:magic-link-fallback]`) rather than the on-screen state. Code format, unknown account, wrong code, expiration and lockout return the same error.

Registration returns the same confirmation for new and existing accounts. Names
and host privileges are applied only after the recipient verifies the short-lived
link or code; invite-code usage is consumed at that point. Profile contact-change
requests also use a generic confirmation and rate limits. Co-host invitations
require a separate normal sign-in and explicit acceptance by the invited account.
All authentication-link redirects use `NEXT_PUBLIC_APP_URL`, with localhost as
the development fallback; forwarded Host headers never select the destination.

---

### Cloudflare Turnstile

- **Required**: No, but strongly recommended for internet-facing installations
- **Default**: Disabled when both values are empty
- **Type**: Cloudflare Turnstile site key and secret key

```env
TURNSTILE_SITE_KEY="your-site-key"
TURNSTILE_SECRET_KEY="your-secret-key"
```

Create a **Managed** Turnstile widget in Cloudflare and restrict it to the hostname in
`NEXT_PUBLIC_APP_URL`. Set both variables together; a partial configuration fails protected
submissions closed.

When enabled, Turnstile protects user-submitted create and edit operations across public guest,
host, and co-host pathways. This includes authentication, event creation and editing, RSVPs and
comments, invitations, messages, uploads, and profile changes. Each submission requires a fresh,
single-use token. Routine state toggles such as check-in, poll voting, potluck claiming, notification
preferences, reordering, and deletes are not challenged. Administrators bypass Turnstile; hosts and
co-hosts do not.

The widget uses Cloudflare's interaction-only Managed mode, so most legitimate users see no prompt.
The application sends each action-bound token directly with the submission that requested it, then
validates the token server-side, including its action and hostname. This keeps overlapping uploads,
comments, and other protected operations independent while preserving Cloudflare's single-use token
requirement. Never expose `TURNSTILE_SECRET_KEY` to the browser.

---

### HEALTH_CHECK_TOKEN

- **Required**: No
- **Default**: _(none)_
- **Type**: Random string

**What it does:** Unlocks the detailed response body of the `GET /api/health` endpoint. The endpoint is public (Docker healthchecks and uptime monitors probe it anonymously), so by default it returns only a minimal liveness signal — `{"status":"ok"}` with HTTP `200` when healthy, `{"status":"unavailable"}` with HTTP `503` when not — and no internal detail.

When `HEALTH_CHECK_TOKEN` is set, requests that present the same value in the `x-health-token` header receive the detailed body instead, including the database migration state (`migrations: "ok" | "pending" | "unreachable"`) and a timestamp:

```bash
curl -H "x-health-token: <your token>" http://localhost:3000/api/health
```

When the variable is unset, every caller gets the minimal body. Requests with a missing or wrong token also get the minimal body — the status code (200/503) is the same either way, so anonymous monitoring keeps working.

**How to generate:** Use the same method as `SESSION_SECRET` (e.g. `openssl rand -base64 32`).

---

### ENCRYPTION_KEY

- **Required**: No (falls back to `SESSION_SECRET` if not set)
- **Default**: _(none)_
- **Type**: Random string (at least 32 characters)

**What it does:** Used to encrypt sensitive configuration credentials (like SMTP passwords and API tokens) at rest before saving them to the database.

**How to generate:** Use the same method as `SESSION_SECRET` to generate a separate unique key.

> **Warning:** If you set this value, do not change or delete it. Changing the key after saving credentials in the Admin Panel will make them unreadable, requiring you to re-enter them in the UI.

Saved provider credentials use versioned AES-256-GCM encryption with a random
salt for each value. Salts are generated automatically and stored with the
ciphertext; no new environment variable is needed. Startup converts older
saved credentials automatically and stops with a redacted error if conversion
cannot be completed. Preserve the existing encryption-key configuration during
upgrades, including the `SESSION_SECRET` fallback. See the
[upgrade and downgrade procedure](./upgrading.md#automatic-configuration-secret-conversion-328--339)
before reverting to an older image. Key rotation is a separate operation.

---

### NEXT_PUBLIC_APP_URL

- **Required**: Yes
- **Default**: _(none)_
- **Type**: URL string (no trailing slash)

**What it does:** The public address where users visit the app. It is used to build invite links, confirmation links, magic sign-in links sent via email/SMS, canonical event-page metadata, and absolute social-preview image URLs. It is also the canonical origin for the redirects issued by the magic-link verification endpoint — when set, the app ignores the request `Host` header for those redirects (a link-poisoning safeguard behind reverse proxies); when unset, the `Host` header is used as a fallback, so production deploys should always set it.

**Examples:**

- Local testing: `http://localhost:3000`
- LAN-only access: `http://192.168.1.50:3000`
- Public HTTPS domain: `https://rsvp.yourdomain.com`

> **Warning:** The `NEXT_PUBLIC_` prefix means this variable is embedded into the frontend JS code and visible in the browser source. Do not put passwords or secrets in this variable.

---

### INITIAL_ADMIN_EMAIL

- **Required**: Yes for first-administrator setup
- **Default**: _(none)_
- **Type**: Email address string

**What it does:** Restricts `/setup` to the server owner's email address. With no
administrator account, the homepage opens setup. Enter your name and this email,
then verify its LOGIN magic link or paired 6-digit code to become the first admin.
Configure email delivery first; production never prints credentials in logs.
No sample data, host invite code, or open registration is needed.

The SYSTEM account does not count as an existing administrator. An existing
administrator blocks new bootstrap promotion. Email matching ignores case and
surrounding whitespace; session reads, profile changes and co-host invitations
cannot promote accounts. If no administrator remains, a fresh verified LOGIN
for the configured address can recover access. Remove this setting after setup
if you do not want that recovery path.

---

### OPEN_REGISTRATION

- **Required**: No
- **Default**: `"false"`
- **Type**: Boolean string (`"true"` or `"false"`)

**What it does:** Controls whether anyone can visit the register page and create a host account.

- `"false"`: Users need an active invite code created in the Admin Panel. The first-administrator setup has its own configured-email restriction.
- `"true"`: Open registration is active; no invite code is requested.

---

### HOST_INVITE_CODE

Retired. This environment variable no longer creates invite codes or gates
startup. Codes already stored in the database remain usable and manageable in
**Admin Panel → Host settings**. Create new codes there after completing `/setup`.
Remove the obsolete variable from your environment.

---

### SEED_TEST_DATA

- **Required**: No
- **Default**: `"false"`
- **Type**: Boolean string (`"true"` or `"false"`)

**What it does:** If set to `"true"` and the database has no events on startup, the application runs a seed script creating 20 test guests and 10 comprehensive sample events. The fixtures cover draft, published, cancelled, past, and upcoming events; all location and visibility modes; password protection; RSVP deadlines, approval, invited/unresponded guests, capacity, plus-ones, and all questionnaire field types; email/SMS invitation history; co-hosts and pending co-host invitations; guest-list privacy; polls, comments, potlucks, updates, reminders, activity, regular check-ins, and walk-ins; and representative theme presets, heading fonts, animated effects, and effect controls.

Both source-build and release Compose files honor this value from `.env`; they
do not force sample data on. When false or unset, the seed command performs no
database writes. Migrations install production presets, and SYSTEM is created
on demand during account deletion. No baseline-seeding flag is needed.

> **Warning:** Turn this off (`"false"`) before inviting real guests to avoid cluttering your dashboard with fake test data.

---

### LOG_LEVEL

- **Required**: No
- **Default**: `"info"`
- **Type**: Enum string (`"debug"`, `"info"`, `"warn"`, `"error"`)

**What it does:** Controls the verbosity of application logs written to stdout. Use `"debug"` to troubleshoot setup or database issues, and `"info"` for standard production runs.

At `"debug"`, the app also surfaces errors from non-critical background work (activity logging, best-effort notification sends, cleanup jobs) that are intentionally swallowed at higher levels so they never break the main request.

---

## Email Configuration

RSVP to Me uses email for magic link logins, notifications, and guest invites. In non-production local development, sign-in links and codes are printed with `[auth:magic-link-fallback]`. Production requires working email delivery and never logs these credentials.

You configure your email provider either in the **Admin Panel** (recommended) or with environment variables. If the Admin Panel has an email provider set, that choice always wins. Otherwise the app auto-detects a provider from your environment variables in this order: **Cloudflare Worker** (when `CLOUDFLARE_WORKER_EMAIL_URL` is set) → **SMTP** (when `SMTP_HOST` is set) → **console logging**. The **Cloudflare REST API** provider is available only by selecting it in the Admin Panel (it is not auto-detected from environment variables).

### EMAIL_FROM

- **Required**: No
- **Default**: `"RSVP to Me <noreply@example.com>"` (set your own address — the default is a placeholder)
- **Type**: Address string

**What it does:** The address shown in the "From" header of sent emails.
_Format:_ `"Display Name <email@domain.com>"` (e.g. `"Sarah's Birthday <rsvp@sarah.com>"`).

> **Warning:** If sending via SMTP, the email address here must match or be authorized by your SMTP provider, otherwise emails will fail SPF verification and go to spam.

---

### SMTP Settings

#### SMTP_HOST

- **Required**: Yes (if using SMTP)
- **Type**: Hostname string (e.g. `smtp.gmail.com`, `smtp.mailgun.org`, `email-smtp.us-east-1.amazonaws.com`)

#### SMTP_PORT

- **Required**: No
- **Default**: `"587"`
- **Type**: Port number string (typically `"587"` for STARTTLS, or `"465"` for implicit TLS)

#### SMTP_SECURE

- **Required**: No
- **Default**: `"false"`
- **Type**: Boolean string (`"true"` or `"false"`)
- **Use case:** Set `"true"` when using port `465` (implicit TLS), or `"false"` when using port `587` (STARTTLS).

#### SMTP_USER

- **Required**: Yes (if using SMTP)
- **Type**: String (usually your email address)

#### SMTP_PASS

- **Required**: Yes (if using SMTP)
- **Type**: String (regular password or provider App Password)
- **Gmail App Passwords:** Create a 16-character App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) if 2-Step Verification is active.

---

### Cloudflare Worker Email

#### CLOUDFLARE_WORKER_EMAIL_URL

- **Required**: Yes (if using Cloudflare Workers)
- **Type**: HTTPS URL string (e.g. `https://rsvp-worker.yourdomain.workers.dev`)

**What it does:** The endpoint of your deployed Cloudflare Worker relay. Must use `https://`.

#### CLOUDFLARE_WORKER_API_SECRET

- **Required**: Yes (if using Cloudflare Workers)
- **Type**: String (shared API secret)
- **How to generate:** Run `openssl rand -hex 32` and configure the exact same string in your Worker's dashboard.

---

### Cloudflare REST API Email

#### CLOUDFLARE_ACCOUNT_ID

- **Required**: Yes (if using Cloudflare REST API)
- **Type**: String (found in your Cloudflare Dashboard sidebar)
- **Format**: Exactly 32 hexadecimal characters. Any other value leaves the Cloudflare REST API provider unavailable, and **Send test email** reports an invalid Account ID without contacting Cloudflare.

#### CLOUDFLARE_API_TOKEN

- **Required**: Yes (if using Cloudflare REST API)
- **Type**: String (API token generated at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens))

---

### INBOUND_FORWARD_TO

- **Required**: No (Cloudflare Worker only)
- **Type**: Email address string

**What it does:** When using the Cloudflare Worker, this is a fallback catch-all email address. By default, guest replies go dynamically to the event host's email (using the Reply-To header). This address is only used if a guest manually types or replies directly to the system From address. Because Cloudflare restricts email forwarding to verified destinations, this fallback address must be verified in your Cloudflare dashboard.

---

## SMS Configuration (Twilio)

SMS is optional. When enabled, it allows sign-in links and 6-digit codes via SMS, text invitations, confirmation texts, and host blasts.

### TWILIO_ACCOUNT_SID

- **Required**: Yes (if using SMS)
- **Type**: String (starts with `AC`)

#### TWILIO_AUTH_TOKEN

- **Required**: Yes (if using SMS)
- **Type**: String (Twilio authentication key)

#### TWILIO_PHONE_NUMBER

- **Required**: Yes (if using SMS)
- **Type**: E.164 formatted phone number (e.g. `+15558675309`, `+447911123456`)

---

## PostgreSQL Configuration

PostgreSQL 18 is the only supported database. Managed PostgreSQL hosting (e.g., Supabase, Neon, AWS RDS) or the bundled `docker-compose.yml` Postgres container are both supported.

### DATABASE_URL (PostgreSQL)

- **Required**: Yes
- **Type**: String (Connection URL)

Your `DATABASE_URL` connection string must follow this format:

```env
DATABASE_URL="postgresql://username:password@hostname:5432/database_name"
```

Or the shorter `postgres://` protocol:

```env
DATABASE_URL="postgres://username:password@hostname:5432/database_name"
```

On container startup the application runs `prisma migrate deploy` to apply any pending schema migrations automatically.

---

## Redis Configuration

Redis is required for session caching, distributed locking, and rate-limiting.

### REDIS_URL

- **Required**: Yes (the app will not start without a valid Redis URL)
- **Type**: String (Redis connection URL)

**Format:**

```env
REDIS_URL="redis://:redis_password@redis_host:6379"
```

When configured, the application enables:

- **Active Session Caching:** Session records are cached in Redis, avoiding SQL database queries on every page load.
- **High-Throughput Rate Limiting:** Sliding-window rate limits are handled in memory by Redis instead of writing transactions to the SQL database.
- **Distributed Cron Locking:** Reminder jobs utilize Redis locks, preventing duplicate message dispatch when running multiple application container replicas.

---

## Database Backup Configuration

Automated and manual database backups use `pg_dump` to create `.sql` dump files saved in `/app/data/backups/`.

### BACKUP_SCHEDULE

- **Required**: No
- **Default**: `disabled`
- **Type**: String (Cron expression or `"disabled"`)

**What it does:** Defines the cron schedule for automated database backups run by the in-process cron scheduler.

- `"disabled"`: Automated backups are turned off.
- `"* * * * *"`: Standard 5-field cron pattern. E.g., `0 0 * * *` triggers a daily backup at midnight.

_Note: This setting can also be configured and updated dynamically at runtime via the **Backups** tab in the Admin Panel._

### BACKUP_KEEP_COUNT

- **Required**: No
- **Default**: `7`
- **Type**: Number string

**What it does:** Sets the rotation retention limit for scheduled and manual
`backup_*.sql` files. The application deletes older ordinary backups only after
a new backup completes. This setting does not control migration snapshots:
startup keeps seven schema snapshots and seven secret-recovery snapshots in
`data/backups/pre-migration/`, independently of scheduled/manual backup rotation.
See [Database Backups](admin.md#database-backups) for recovery and visibility.

_Note: This setting can also be configured and updated dynamically at runtime via the **Backups** tab in the Admin Panel._

---

## Quick Reference Table

| Variable                       | Required        | Default             | Description                                                                                                     |
| ------------------------------ | --------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | Yes             | _(none)_            | PostgreSQL 18 connection URL (e.g. `postgresql://user:pass@host:5432/db`).                                      |
| `REDIS_URL`                    | Yes             | _(none)_            | Redis connection URL for caching, rate limits, and distributed locks.                                           |
| `BACKUP_SCHEDULE`              | No              | `disabled`          | Cron expression (e.g. `0 0 * * *`) to schedule automated database backups.                                      |
| `BACKUP_KEEP_COUNT`            | No              | `7`                 | Maximum number of backup files to retain before rotating.                                                       |
| `SESSION_SECRET`               | Yes             | _(none)_            | Random string (32+ chars) for signing session cookies.                                                          |
| `TRUSTED_IP_HEADER`            | No              | _(none)_            | Trusted proxy header for client IP (e.g. CF-Connecting-IP). Unset = headers not trusted; set it behind a proxy. |
| `TURNSTILE_SITE_KEY`           | No              | _(none)_            | Public key for a Cloudflare Turnstile Managed widget; set with the secret key to enable protection.             |
| `TURNSTILE_SECRET_KEY`         | No              | _(none)_            | Server-only Turnstile verification key; set with the site key and never expose it publicly.                     |
| `HEALTH_CHECK_TOKEN`           | No              | _(none)_            | Token for the `x-health-token` header that unlocks the detailed `/api/health` body (migration state).           |
| `ENCRYPTION_KEY`               | No              | _(falls back)_      | Encryption key for database-stored credentials.                                                                 |
| `NEXT_PUBLIC_APP_URL`          | Yes             | _(none)_            | Base URL for accessing the application.                                                                         |
| `INITIAL_ADMIN_EMAIL`          | No              | _(none)_            | Email promoted after verified LOGIN link/code use if no other admins exist.                                     |
| `OPEN_REGISTRATION`            | No              | `"false"`           | If `"true"`, allows host signups without invite codes.                                                          |
| `HOST_INVITE_CODE`             | Retired         | Ignored             | Manage database invite codes through the Admin Panel.                                                           |
| `SEED_TEST_DATA`               | No              | `"false"`           | If `"true"`, seeds mock test events on first run.                                                               |
| `LOG_LEVEL`                    | No              | `"info"`            | Logging verbosity (`debug`, `info`, `warn`, `error`).                                                           |
| `EMAIL_FROM`                   | No              | _(noreply address)_ | From header display name and email address.                                                                     |
| `SMTP_HOST`                    | Yes (if SMTP)   | _(none)_            | Outgoing SMTP mail server hostname.                                                                             |
| `SMTP_PORT`                    | No              | `"587"`             | Outgoing SMTP mail server port.                                                                                 |
| `SMTP_SECURE`                  | No              | `"false"`           | Set `"true"` for port 465, `"false"` for port 587.                                                              |
| `SMTP_USER`                    | Yes (if SMTP)   | _(none)_            | Outgoing SMTP username.                                                                                         |
| `SMTP_PASS`                    | Yes (if SMTP)   | _(none)_            | Outgoing SMTP password or App Password.                                                                         |
| `CLOUDFLARE_WORKER_EMAIL_URL`  | Yes (if Worker) | _(none)_            | HTTPS URL of your deployed Cloudflare Worker.                                                                   |
| `CLOUDFLARE_WORKER_API_SECRET` | Yes (if Worker) | _(none)_            | Shared secret token to authorize Worker requests.                                                               |
| `CLOUDFLARE_ACCOUNT_ID`        | Yes (if CF API) | _(none)_            | Cloudflare Account ID.                                                                                          |
| `CLOUDFLARE_API_TOKEN`         | Yes (if CF API) | _(none)_            | Cloudflare API Token with Email Sending permissions.                                                            |
| `INBOUND_FORWARD_TO`           | No              | _(none)_            | Fallback catch-all email address for direct replies.                                                            |
| `TWILIO_ACCOUNT_SID`           | Yes (if SMS)    | _(none)_            | Twilio Account identifier.                                                                                      |
| `TWILIO_AUTH_TOKEN`            | Yes (if SMS)    | _(none)_            | Twilio API authentication token.                                                                                |
| `TWILIO_PHONE_NUMBER`          | Yes (if SMS)    | _(none)_            | Twilio phone number in E.164 format.                                                                            |

## Upload storage and cleanup

New cover and avatar uploads are recorded in the database with their uploader
and byte size. Each account, including admins, has a fixed **100 MiB** quota;
the individual file limit remains **8 MiB**. Concurrent uploads share a database
lock, so they cannot exceed the quota. A quota rejection shows a full-storage message and leaves the current
image unchanged. Remove unused covers or avatars to free space; an image shared
by another event/profile stays allocated until its last reference is removed.

Replacing/removing an image, deleting an event, or anonymizing an account
reclaims files no longer used by any cover or avatar. Account deletion keeps
covers of retained past events. Failed filesystem deletions are logged safely
and retried by the daily cleanup. Cleanup runs at startup and with the existing
daily 01:00 server-time maintenance job. Unattached files are eligible after
**24 hours**, so an upload awaiting assignment is not immediately removed.
Only regular files with application-generated image names are considered.

The migration in `prisma/postgres-migrations/20261115130000_upload_accounting`
adds accounting for new uploads without guessing ownership of existing files.
Existing referenced files remain available and do not count toward the quota;
existing unreferenced files older than 24 hours are eligible for cleanup. Keep
matching database and upload backups before upgrading: a file removed from the
live uploads folder cannot be recovered by restoring the database alone.
