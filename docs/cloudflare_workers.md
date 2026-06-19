# Cloudflare Workers Email Integration Setup Guide

This guide describes how to configure the Cloudflare Workers outbound and inbound email transport layer for the RSVP to Me application.

Once configured, the application sends all outbound transactional emails (such as magic links, guest RSVPs, and host updates) natively via Cloudflare's `send_email` bindings, and forwards guest replies back to the host.

---

## 1. Deploy the Cloudflare Worker

The worker code is located under the `/worker` directory.

1. Navigate to the worker directory:
   ```bash
   cd worker
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Login and deploy to Cloudflare:
   ```bash
   npx wrangler login
   npx wrangler deploy
   ```
   *Note the URL of the deployed worker (e.g. `https://rsvp-email-worker.yourname.workers.dev`).*

4. Set the worker secrets:
   ```bash
   # Secret token to authorize Next.js sending requests
   npx wrangler secret put WORKER_API_SECRET

   # Default backup inbox for guest replies
   npx wrangler secret put INBOUND_FORWARD_TO
   ```

---

## 2. Configure Cloudflare Email Routing

To forward replies sent to your domain (e.g., guests replying to RSVP emails):

1. Go to your Cloudflare Dashboard: **Websites > [Your Domain] > Email > Email Routing > Routes**.
2. Click **Add route**.
3. Configure the route:
   - **Custom address**: Enter a catch-all or a specific address (e.g., `rsvps@yourdomain.com`).
   - **Action**: Select **Send to Worker**.
   - **Destination worker**: Select `rsvp-email-worker`.
4. Click **Save**.

---

## 3. Configure the RSVP to Me Application

You can configure the application's email delivery settings in one of two ways:

### Option A: via Admin Panel (Recommended - No Container Restart Needed)
1. Log in to the application as an `ADMIN` user.
2. Go to the Admin dashboard at `/admin` and select the **Settings** tab.
3. Under **Server Configuration & Email Delivery**:
   - Change the **Email Provider** selection to **Cloudflare Workers**.
   - Set **From Address** to your verified sender address (e.g., `RSVP to Me <noreply@yourdomain.com>`).
   - Set **Worker Email URL** to your deployed worker URL.
   - Set **Worker API Secret** to your configured `WORKER_API_SECRET`.
4. Click **Save Settings**.

### Option B: via Docker Compose / Environment Variables
Add the following variables to your `docker-compose.yml` or `.env` file and restart the container:

```yaml
environment:
  # ... existing variables ...
  CLOUDFLARE_WORKER_EMAIL_URL: "https://rsvp-email-worker.yourname.workers.dev"
  CLOUDFLARE_WORKER_API_SECRET: "your-strong-worker-api-secret-token"
```

*Note: Database configuration in the Admin Panel takes priority over environment variables. If no configuration is present in either the database or environment variables, the system automatically falls back to standard SMTP sending or console logging in development.*
