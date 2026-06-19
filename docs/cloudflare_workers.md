# Cloudflare Email Integration Setup Guide

This guide describes how to configure the Cloudflare Email integration for the **RSVP to Me** application. We support two methods:

*   **Option A: Cloudflare Email REST API (Recommended for Simple Outbound Setup)**
    *   *Complexity:* Very Low (takes 2 minutes)
    *   *Capability:* Outbound sending only. Guest replies will not trigger automatic worker-based RSVP confirmations (standard forwarding rules still work).
*   **Option B: Cloudflare Workers Integration (Full Inbound & Outbound Auto-Replies)**
    *   *Complexity:* Medium (takes 5 minutes)
    *   *Capability:* Outbound sending and automatic confirmation replies when guests respond to invite emails.

---

## ⚠️ CRITICAL PREREQUISITE: Authorize Cloudflare Email Sending (SPF & DKIM)

Before you configure either option below, you **MUST** authorize Cloudflare to send emails on behalf of your domain. If you skip this, major providers (like Gmail and Yahoo) will block or reject your emails due to **DMARC policy violations** (as indicated by errors like `5.7.26 Unauthenticated email...`).

To authorize email sending:
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com) and click on your domain.
2. In the left-hand sidebar, navigate to **Email** > **Email Routing** (or **Email** > **Email Sending** if available).
3. Select the **Email Sending** (or **Sending**) tab at the top.
4. Click **Get Started** or **Configure**.
5. Cloudflare will present the required DNS records to sign and authorize your emails:
   * **TXT (SPF) record** for `cf-bounce.yourdomain.com` (authorizes Cloudflare's servers).
   * **TXT (DKIM) record** for `cf-bounce._domainkey.yourdomain.com` (cryptographically signs your outbound emails).
   * **MX record** for `cf-bounce.yourdomain.com` (tracks bounced emails).
6. Click **Add records automatically** to let Cloudflare insert these records into your DNS settings, or copy them and add them manually under **DNS** > **Records**.
7. Wait for the status of your domain under the Sending tab to show as **Active** or **Verified** (this usually takes 1-2 minutes).

Once verified, continue to configure Option A or Option B below.

---

## Option A: Cloudflare Email REST API (Outbound Only)

This option allows the application to send invite and confirmation emails directly using Cloudflare's transactional email API, without needing to create or deploy any Workers.

### 1. Get your Cloudflare Account ID
1. Go to your domain page on the [Cloudflare Dashboard](https://dash.cloudflare.com).
2. On the right-hand sidebar of the Overview page, locate the **Account ID** section.
3. Copy the 32-character string.

### 2. Create a Cloudflare API Token
To authorize email sending, you must create a custom API Token with restricted permissions:
1. In the top-right corner of the Cloudflare Dashboard, click the user profile icon and select **My Profile**.
2. Click **API Tokens** in the sidebar.
3. Click **Create Token**.
4. Scroll to the bottom of the page and click **Create Custom Token**.
5. Set the **Token name** to something recognizable, like `RSVP to Me Sending Token`.
6. Under **Permissions**, add the following rule:
   * **Account** | **Email Sending** | **Edit**
7. Under **Account Resources**, choose **Include** and select your account.
8. Under **Zone Resources**, choose **Include** > **Specific zone** > select your domain.
9. Click **Continue to summary**, then click **Create Token**.
10. Copy the generated token and save it somewhere secure (it will only be shown once).

### 3. Configure RSVP to Me Settings
1. Log in to the application as an `ADMIN` user.
2. Go to the Admin settings panel at `/admin` and select the **Settings** tab.
3. Under **Server Configuration & Email Delivery**:
   * Select **Cloudflare Email REST API** as your Email Provider.
   * **From Address**: Enter your sending address (e.g., `RSVP to Me <rsvps@yourdomain.com>`).
   * **Cloudflare Account ID**: Paste your 32-character Account ID.
   * **Cloudflare API Token**: Paste your custom API Token.
4. Click **Save Settings** and then click **Test Connection** to verify end-to-end delivery.

---

## Option B: Cloudflare Workers Integration (Full Setup)

This option deploys a small Worker to handle outbound sending and automatically intercept inbound replies from guests to perform auto-responses.

### 1. Deploy the Cloudflare Worker (No CLI Required)
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com).
2. From the sidebar, navigate to **Workers & Pages** > **Create application** > **Create Worker**.
3. Name your worker (for example, `rsvp-email-worker`) and click **Deploy**.
4. Once deployed, click **Edit Code** to open the online Quick Edit editor.
5. Delete the default boilerplate code, copy the entire contents of `worker/worker.ts` (or copy the generated code directly from the **RSVP to Me** Admin settings panel at `/admin`), and paste it into the editor.
6. Click **Save and deploy** at the top right.

### 2. Configure Worker Variables and Email Service Binding
1. In the left-hand sidebar of the main Cloudflare Dashboard, navigate to **Workers & Pages**.
2. Click on your newly created worker (e.g., `rsvp-email-worker`) to open its overview dashboard.
3. Select the **Settings** tab at the top.
4. In the settings left-side menu, select **Variables** (within the **Variables & Secrets** section).
5. **Add the Environment Variables**:
   * Under the **Environment Variables** table, click the **Edit variables** button first (you must click this to edit variables).
   * Click **Add variable**:
     * **Name/Key**: `WORKER_API_SECRET`
     * **Type**: Change this from *Text* to **Secret** (by clicking the dropdown or padlock icon).
     * **Value**: Paste the secure API secret token you generated/entered in the RSVP to Me Admin settings panel.
   * Click **Add variable** again:
     * **Name/Key**: `INBOUND_FORWARD_TO`
     * **Type**: Leave as **Text**.
     * **Value**: Enter the destination email where you want to receive guest replies (e.g., your personal email address).
6. **Add the Email Service Binding**:
   * Scroll down to the **Bindings** section on the same page.
   * Click **Add binding**.
   * **Type**: Select **Email Service** from the dropdown menu.
   * **Variable name / Name**: Enter `EMAIL` (in all capital letters).
   * **Value / Destination**: *Note: For Email Service bindings, do NOT enter any value. Leave this blank. Once saved, Cloudflare will automatically display this as a dash (`—`), which is the correct and expected behavior.*
7. Click the **Save and deploy** button at the bottom of the page to apply both the environment variables and the binding.

### 3. Configure Cloudflare Email Routing (Inbound Route)
1. Go back to the main Cloudflare Dashboard home and select your domain under **Websites**.
2. From the left-hand sidebar, navigate to **Email** > **Email Routing** > **Routes**.
3. Under the **Destination addresses** tab, ensure the destination email you used for `INBOUND_FORWARD_TO` is verified (if not, add it and click the verification link in the email Cloudflare sends you).
4. Select the **Routing Rules** tab and click **Add route**:
   * **Custom address**: Enter your custom sender email address (e.g., `rsvps@yourdomain.com`). This should match the **From Address** you configure in the RSVP to Me Admin panel.
   * **Action**: Select **Send to Worker** from the dropdown.
   * **Destination worker**: Select your worker (`rsvp-email-worker`).
5. Click **Save**.

### 4. Configure the RSVP to Me Application
1. Log in to the application as an `ADMIN` user.
2. Go to the Admin settings panel at `/admin` and select the **Settings** tab.
3. Under **Server Configuration & Email Delivery**:
   * Select **Cloudflare Workers** as your Email Provider.
   * **From Address**: Enter your verified domain address (e.g., `RSVP to Me <rsvps@yourdomain.com>`).
   * **Worker Email URL**: Enter your deployed worker URL (e.g., `https://rsvp-email-worker.yourname.workers.dev`).
   * **Worker API Secret**: Enter the same token you set for `WORKER_API_SECRET`.
4. Click **Save Settings** and then click **Test Connection** to verify end-to-end delivery.
