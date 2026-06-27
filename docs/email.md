# Email Setup Guide

RSVP to Me sends email notifications for passwordless logins (magic links), guest invitations, RSVP confirmations, event updates, and automated reminders. This guide explains how to configure each supported email provider.

---

## Table of Contents

1. [How Email Works in the App](#how-email-works-in-the-app)
2. [What Happens Without Email Configured](#what-happens-without-email-configured)
3. [Choosing a Provider](#choosing-a-provider)
4. [Option A: SMTP](#option-a-smtp)
   - [Gmail Setup](#gmail-setup)
   - [Outlook / Hotmail Setup](#outlook--hotmail-setup)
   - [Fastmail Setup](#fastmail-setup)
   - [Mailgun Setup](#mailgun-setup)
   - [Amazon SES Setup](#amazon-ses-setup)
5. [Option B: Cloudflare Workers (Full Setup)](#option-b-cloudflare-workers-full-setup)
6. [Option C: Cloudflare REST API (Outbound Only)](#option-c-cloudflare-rest-api-outbound-only)
7. [Testing Your Email Configuration](#testing-your-email-configuration)
8. [Troubleshooting](#troubleshooting)
9. [SPF, DKIM, and DMARC Explained](#spf-dkim-and-dmarc-explained)

---

## How Email Works in the App

Email dispatches are triggered by the following application events:

| Trigger                                            | Recipients                                            |
| -------------------------------------------------- | ----------------------------------------------------- |
| User requests login link                           | The requesting user (magic link)                      |
| Host invites guests                                | The invited guests                                    |
| Guest submits an RSVP                              | The guest (confirmation) & the host (new RSVP alert)  |
| Host approves/declines a pending RSVP              | The approved/declined guest                           |
| Host sends an event update blast                   | All Going and Maybe guests (if notify is selected)    |
| Automated reminder (7 days, 1 day, N hours before) | All Going and Maybe guests with notifications enabled |
| Nudge for unresponded guests                       | Invited guests who have not responded yet             |
| Profile email change verification                  | The user's new email address                          |

_Note on Reminders:_ The in-process cron scheduler checks every 15 minutes to trigger due reminders. Each reminder type is sent exactly once per user per event.

_Note on Notification Toggles:_ Hosts can control which of the above fire on a per-event basis under **Event Settings → RSVP Options → Notification Settings**. Individual toggles exist for guest confirmations (email/SMS), host RSVP alerts (email/SMS), and approval notifications (email/SMS).

---

## What Happens Without Email Configured

If no email settings are configured in `.env` or the Admin Panel, the application defaults to **console logging**. Magic links and message bodies are written to the container's standard output instead of being sent.

You can retrieve magic links for testing by running:

```bash
docker compose logs app | grep -i "magic link"
```

_Note:_ This fallback is great for local development but is not suitable for production.

---

## Choosing a Provider

We support three email delivery channels. Select the option that best fits your hosting setup:

| Provider                | Best for                                                                                        | Inbound replies       | Setup Complexity |
| ----------------------- | ----------------------------------------------------------------------------------------------- | --------------------- | ---------------- |
| **SMTP**                | Most users (uses existing personal or business email accounts).                                 | No                    | Low              |
| **Cloudflare Workers**  | Custom domain owners using Cloudflare DNS who want guests to be able to reply to update emails. | Yes (Auto-forwarding) | Medium           |
| **Cloudflare REST API** | Cloudflare DNS users who want a quick outbound setup without deploying serverless worker code.  | No                    | Low-Medium       |

---

## Option A: SMTP

SMTP is the simplest option. Add these variables to your `.env`:

```env
SMTP_HOST="smtp.provider.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="username@domain.com"
SMTP_PASS="your-password"
EMAIL_FROM="RSVP to Me <username@domain.com>"
```

---

### Gmail Setup

Gmail requires using an **App Password** instead of your main Google password.

1. **Enable 2-Step Verification:**
   - Go to [Google Account Security](https://myaccount.google.com/security).
   - Under "How you sign in to Google", click **2-Step Verification** and follow the prompts to activate it.
2. **Create an App Password:**
   - Go to [Google App Passwords](https://myaccount.google.com/apppasswords).
   - In the **App name** field, type `rsvp-to-me` and click **Create**.
   - Copy the 16-character code (e.g. `abcd efgh ijkl mnop`) shown on screen.
3. **Configure your `.env`:**
   ```env
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="587"
   SMTP_SECURE="false"
   SMTP_USER="youraddress@gmail.com"
   SMTP_PASS="abcdefghijklmnop"
   EMAIL_FROM="RSVP to Me <youraddress@gmail.com>"
   ```
   _Note: Free Gmail accounts are subject to a sending limit of ~500 emails per day._

---

### Outlook / Hotmail Setup

1. **Create an App Password (if 2FA is active):**
   - Go to [Microsoft Account Security](https://account.microsoft.com/security) and click **Advanced security options**.
   - Under the "App passwords" header, click **Create a new app password** and copy the code.
2. **Configure your `.env`:**
   ```env
   SMTP_HOST="smtp-mail.outlook.com"
   SMTP_PORT="587"
   SMTP_SECURE="false"
   SMTP_USER="youraddress@outlook.com"
   SMTP_PASS="your-app-password"
   EMAIL_FROM="RSVP to Me <youraddress@outlook.com>"
   ```

---

### Fastmail Setup

1. **Create an App Password:**
   - Go to Fastmail **Settings** > **Developer keys** > [New App Password](https://www.fastmail.com/settings/security/devicekeys/new).
   - Set the name to `rsvp-to-me` and access level to `Mail (IMAP/POP/SMTP)`.
   - Click **Generate password** and copy the key.
2. **Configure your `.env`:**
   ```env
   SMTP_HOST="smtp.fastmail.com"
   SMTP_PORT="587"
   SMTP_SECURE="false"
   SMTP_USER="youraddress@fastmail.com"
   SMTP_PASS="your-app-password"
   EMAIL_FROM="RSVP to Me <youraddress@fastmail.com>"
   ```

---

### Mailgun Setup

1. **Add and Verify your Domain:**
   - Sign up at [Mailgun](https://www.mailgun.com).
   - Go to **Sending** > **Domains** > **Add New Domain** and enter your custom domain.
   - Add the TXT/MX records shown by Mailgun to your DNS registrar to verify ownership.
2. **Get SMTP Credentials:**
   - Go to your domain settings in the Mailgun dashboard and click **SMTP credentials**.
   - Click **Create new SMTP user** and note the username and generated password.
3. **Configure your `.env`:**
   ```env
   SMTP_HOST="smtp.mailgun.org" # Use "smtp.eu.mailgun.org" if your domain is in the EU region
   SMTP_PORT="587"
   SMTP_SECURE="false"
   SMTP_USER="postmaster@yourdomain.com"
   SMTP_PASS="your-mailgun-smtp-password"
   EMAIL_FROM="RSVP to Me <noreply@yourdomain.com>"
   ```

---

### Amazon SES Setup

1. **Verify your Identity:**
   - Open the AWS Console and go to **Amazon SES**.
   - Click **Verified identities** > **Create identity**. Choose "Email address" or "Domain" and complete the verification steps.
2. **Create SMTP Credentials:**
   - In the SES console, navigate to **Account dashboard** > **SMTP settings** > **Create SMTP credentials**.
   - Generate the credentials and download the CSV file containing your SMTP username and password.
3. **Configure your `.env`:**
   ```env
   SMTP_HOST="email-smtp.us-east-1.amazonaws.com" # Replace with your active AWS region
   SMTP_PORT="587"
   SMTP_SECURE="false"
   SMTP_USER="YOUR_SES_SMTP_USERNAME"
   SMTP_PASS="YOUR_SES_SMTP_PASSWORD"
   EMAIL_FROM="RSVP to Me <noreply@yourverifieddomain.com>"
   ```
   _Note: Newly created AWS SES accounts are placed in sandbox mode. You must request sandbox removal from AWS to email unverified guest addresses._

---

## Option B: Cloudflare Workers (Full Setup)

This option deploys a small serverless script to your Cloudflare account. It handles outbound email delivery and forwards inbound guest replies back to your personal email address.

### Prerequisites

- A domain managed by Cloudflare DNS.
- Cloudflare Email Routing enabled on that domain (navigate to **Email** > **Email Routing** > **Get Started** to insert the default MX records automatically).

---

### 1. Configure SPF and DKIM

To authorize Cloudflare to send emails on behalf of your domain:

1. Under **Email Routing**, go to the **Email Sending** tab.
2. Follow the setup wizard to add the required SPF (TXT), DKIM (TXT), and tracking (MX) records to your DNS list.
3. Wait for the Domain Status to show as **Active** or **Verified**.

---

### 2. Deploy the Worker

We use Wrangler CLI to compile and push the worker:

1. Install [Node.js](https://nodejs.org) (LTS version) on your machine.
2. Open a terminal, navigate to the `worker/` directory inside the repository, and install wrangler:
   ```bash
   npm install -g wrangler
   ```
3. Log in to your Cloudflare account:
   ```bash
   wrangler login
   ```
4. Deploy the worker script:
   ```bash
   wrangler deploy
   ```
5. Copy the deployed worker URL (e.g. `https://rsvp-email-worker.yourname.workers.dev`).

---

### 3. Bind Secrets & Variables in Cloudflare

1. Generate a strong API secret token:
   ```bash
   openssl rand -hex 32
   ```
2. Bind this secret key to your deployed Worker:
   ```bash
   wrangler secret put API_SECRET
   # Paste your generated hex string when prompted
   ```
3. In the Cloudflare Dashboard:
   - Navigate to **Workers & Pages** > click on your worker (`rsvp-email-worker`) > **Settings** > **Variables**.
   - Under **Environment Variables**, click **Edit variables** and add `INBOUND_FORWARD_TO` (Text type) with your admin/fallback email address (e.g. `you@domain.com`) as the value. _Note: Guest replies go dynamically to each host's email by default using the Reply-To header; this address is only a fallback for direct replies._
   - Scroll down to **Bindings** > click **Add binding** > select **Email Service** > set Variable Name to `EMAIL` (all uppercase) and save.

---

### 4. Create the Inbound Email Route

1. Go back to your domain's **Email Routing** > **Routes** tab.
2. Under **Destination addresses**, make sure your forwarding email address is verified.
3. Under **Routing Rules**, click **Add route**:
   - _Custom Address:_ The email address you want to send invites from (e.g., `rsvps@yourdomain.com`).
   - _Action:_ Select **Send to Worker**.
   - _Destination Worker:_ Select your deployed worker (`rsvp-email-worker`).
4. Click **Save**.

---

### 5. Configure your `.env`

Enable the Worker integration in your app:

```env
CLOUDFLARE_WORKER_EMAIL_URL="https://rsvp-email-worker.yourname.workers.dev"
CLOUDFLARE_WORKER_API_SECRET="your-generated-hex-secret"
EMAIL_FROM="RSVP to Me <rsvps@yourdomain.com>"
INBOUND_FORWARD_TO="you@domain.com" # Admin fallback email address
```

Leave all `SMTP_*` fields blank.

---

## Option C: Cloudflare REST API (Outbound Only)

If you do not need inbound guest replies forwarded to you, you can call Cloudflare's Email Routing API directly without setting up Wrangler or deploying a Worker.

1. **Enable Email Routing:** Ensure Email Routing is active on your domain in Cloudflare.
2. **Find your Account ID:** Select your domain in the Cloudflare Dashboard and copy the **Account ID** from the right sidebar.
3. **Create an API Token:**
   - Go to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens).
   - Click **Create Token** > select the **Send Email** template (or create a custom token granting **Account** | **Email Sending** | **Edit**).
   - Scope it to your account and copy the generated token.
4. **Provide your credentials.** Set both the Account ID and API token — either in the Admin Panel (**Admin → Email**) or in your `.env`:
   ```env
   CLOUDFLARE_ACCOUNT_ID="your-cloudflare-account-id"
   CLOUDFLARE_API_TOKEN="your-api-token"
   EMAIL_FROM="RSVP to Me <rsvps@yourdomain.com>"
   ```
   Leave all `SMTP_*` and `CLOUDFLARE_WORKER_*` fields blank.
5. **Select the provider.** In **Admin → Email**, set the Email Provider to **Cloudflare REST API**. This is required — unlike SMTP and the Cloudflare Worker, the REST API provider is never auto-detected from environment variables alone, so without this selection the app falls back to console logging.

---

## Testing Your Email Configuration

To verify that your configuration works:

1. Log in to the application as an `ADMIN` user.
2. Go to the Admin settings panel at `/admin` and click the **System Configuration** tab.
3. Under the **Email Settings** block, click **Send Test Email**.
4. Type in your email address and click Send.
5. Check your inbox and spam folder.

If the email does not arrive, inspect your container logs:

```bash
docker compose logs app | grep -i email
```

---

## Troubleshooting

### "Connection refused" or "Network Error"

- Ensure that `SMTP_HOST` is spelled correctly.
- Check that `SMTP_PORT` matches your provider's requirements.
- Some home internet service providers block port `25` or `587` outbound. Try configuring port `465` with `SMTP_SECURE="true"`.

### "Authentication failed" / "535 Invalid credentials"

- **Gmail:** Double-check that you created a 16-character App Password, and that you are not entering your regular Google login password.
- **Outlook:** Ensure that App Passwords are created if 2FA is active on your Microsoft account.
- Check that `SMTP_USER` is your full email address.

### Emails are going straight to spam

This indicates that the receiving mail server is rejecting your emails due to authentication failure.

- Ensure your `EMAIL_FROM` matches the domain you are authorized to send from.
- Check that your DNS registrar contains active SPF, DKIM, and DMARC records (see below).

### The Cloudflare Worker returns 401 Unauthorized

The `CLOUDFLARE_WORKER_API_SECRET` defined in your `.env` file does not match the secret bound to your Cloudflare Worker. Run `wrangler secret put API_SECRET` again to overwrite it with the matching value.

---

## SPF, DKIM, and DMARC Explained

These three DNS records verify to receiving email servers that email sent from your domain is authorized.

### SPF (Sender Policy Framework)

An SPF record lists the mail servers that are allowed to send emails on behalf of your domain. It is added as a **TXT** record at your domain registrar.

- _For Gmail SMTP:_
  ```
  v=spf1 include:_spf.google.com ~all
  ```
- _For Cloudflare Email Routing:_
  ```
  v=spf1 include:_spf.mx.cloudflare.net ~all
  ```

### DKIM (DomainKeys Identified Mail)

DKIM signs outgoing emails with a cryptographic key. The public key is published in your domain's DNS records, allowing mail servers to verify that the message wasn't altered in transit. Your email provider will generate the specific TXT/CNAME records for you to add.

### DMARC (Domain-based Message Authentication)

DMARC instructs receiving mail servers on what to do if an email fails SPF or DKIM checks.
Add a **TXT** record with the Host/Name set to `_dmarc.yourdomain.com`:

```
v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@yourdomain.com
```

- `p=quarantine` tells servers to put failing emails into the spam folder.
- `p=none` is a safe testing option that just monitors without filtering.

### Where to Add Records

Log in to the dashboard of the company where you purchased your domain (e.g. Cloudflare, GoDaddy, Namecheap, Name.com) and navigate to **DNS Settings** > **DNS Records** to add these TXT and CNAME values.
