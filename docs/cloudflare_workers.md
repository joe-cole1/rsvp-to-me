# Cloudflare Email Integration Setup Guide

This guide describes how to configure the Cloudflare Email integration for the **RSVP to Me** application. We support two methods:

*   **Option A: Cloudflare Email REST API (Recommended for Simple Outbound Setup)**
    *   *Complexity:* Very Low (takes 2 minutes)
    *   *Capability:* Outbound sending only. Guest replies will not trigger automatic worker-based RSVP confirmations (standard forwarding rules still work).
*   **Option B: Cloudflare Workers Integration (Full Inbound & Outbound Auto-Replies)**
    *   *Complexity:* Medium (takes 5 minutes)
    *   *Capability:* Outbound sending and automatic confirmation replies when guests respond to invite emails.

---

## Option A: Cloudflare Email REST API (Outbound Only)

This option allows the application to send invite and confirmation emails directly using Cloudflare's transactional email API, without needing to create or deploy any Workers.

### 1. Get your Cloudflare Account ID
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Click on your website domain from the list.
3. On the right-hand sidebar of the Overview page, locate the **Account ID** section.
4. Copy the 32-character string.

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
1. Go back to your worker’s dashboard in Cloudflare.
2. Select the **Settings** tab, then select **Variables** (within the **Variables & Secrets** section).
3. Under **Environment Variables**, click **Add variable** and configure the following:
   * **Variable name**: `WORKER_API_SECRET`
     * Set it as a **Secret** and enter a strong, random password. (Ensure this matches the **Worker API Secret** you enter in the RSVP to Me Admin panel).
   * **Variable name**: `INBOUND_FORWARD_TO`
     * Set it as a **Text** value and enter the destination email where you want to receive guest replies (e.g., your personal host email address).
4. Under **Send Email Bindings** on the same page:
   * Click **Add binding**.
   * Set **Variable name** to `EMAIL`.
5. Click **Save and Deploy** (or **Save** at the bottom of the page) to apply the configurations.

### 3. Configure Cloudflare Email Routing
1. Navigate back to your account home in the Cloudflare Dashboard.
2. Select your domain under **Websites**.
3. From the sidebar, go to **Email** > **Email Routing** > **Routes**.
4. Ensure your host destination email (the address you entered in `INBOUND_FORWARD_TO`) is verified under the **Destination addresses** tab.
5. Under the **Routing Rules** tab, click **Add route**:
   * **Custom address**: Enter your preferred sender routing address (e.g., `rsvps@yourdomain.com`).
   * **Action**: Select **Send to Worker**.
   * **Destination worker**: Select `rsvp-email-worker`.
6. Click **Save**.

### 4. Configure the RSVP to Me Application
1. Log in to the application as an `ADMIN` user.
2. Go to the Admin settings panel at `/admin` and select the **Settings** tab.
3. Under **Server Configuration & Email Delivery**:
   * Select **Cloudflare Workers** as your Email Provider.
   * **From Address**: Enter your verified domain address (e.g., `RSVP to Me <rsvps@yourdomain.com>`).
   * **Worker Email URL**: Enter your deployed worker URL (e.g., `https://rsvp-email-worker.yourname.workers.dev`).
   * **Worker API Secret**: Enter the same token you set for `WORKER_API_SECRET`.
4. Click **Save Settings** and then click **Test Connection** to verify end-to-end delivery.
