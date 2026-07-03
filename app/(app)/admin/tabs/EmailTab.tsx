"use client";

import { Eye, EyeOff } from "lucide-react";
import { APP_SHELL } from "@/lib/theme";

export function EmailTab({
  config,
  handleToggleEmailEnabled,
  handleSaveEmailConfig,
  emailProvider,
  setEmailProvider,
  emailFrom,
  setEmailFrom,
  smtpHost,
  setSmtpHost,
  smtpPort,
  setSmtpPort,
  smtpSecure,
  setSmtpSecure,
  smtpUser,
  setSmtpUser,
  smtpPass,
  setSmtpPass,
  cfAccountId,
  setCfAccountId,
  cfApiToken,
  setCfApiToken,
  showCfApiToken,
  setShowCfApiToken,
  cfWorkerUrl,
  setCfWorkerUrl,
  suggestedSubdomain,
  showSecret,
  setShowSecret,
  cfWorkerSecret,
  setCfWorkerSecret,
  secretCopied,
  setSecretCopied,
  cfInboundForwardTo,
  setCfInboundForwardTo,
  copied,
  setCopied,
  showCode,
  setShowCode,
  isPending,
  isTestingEmail,
  handleTestEmailConfig,
}: {
  config: Record<string, string>;
  handleToggleEmailEnabled: () => void;
  handleSaveEmailConfig: (e: React.FormEvent) => void;
  emailProvider: string;
  setEmailProvider: React.Dispatch<React.SetStateAction<string>>;
  emailFrom: string;
  setEmailFrom: React.Dispatch<React.SetStateAction<string>>;
  smtpHost: string;
  setSmtpHost: React.Dispatch<React.SetStateAction<string>>;
  smtpPort: string;
  setSmtpPort: React.Dispatch<React.SetStateAction<string>>;
  smtpSecure: boolean;
  setSmtpSecure: React.Dispatch<React.SetStateAction<boolean>>;
  smtpUser: string;
  setSmtpUser: React.Dispatch<React.SetStateAction<string>>;
  smtpPass: string;
  setSmtpPass: React.Dispatch<React.SetStateAction<string>>;
  cfAccountId: string;
  setCfAccountId: React.Dispatch<React.SetStateAction<string>>;
  cfApiToken: string;
  setCfApiToken: React.Dispatch<React.SetStateAction<string>>;
  showCfApiToken: boolean;
  setShowCfApiToken: React.Dispatch<React.SetStateAction<boolean>>;
  cfWorkerUrl: string;
  setCfWorkerUrl: React.Dispatch<React.SetStateAction<string>>;
  suggestedSubdomain: string;
  showSecret: boolean;
  setShowSecret: React.Dispatch<React.SetStateAction<boolean>>;
  cfWorkerSecret: string;
  setCfWorkerSecret: React.Dispatch<React.SetStateAction<string>>;
  secretCopied: boolean;
  setSecretCopied: React.Dispatch<React.SetStateAction<boolean>>;
  cfInboundForwardTo: string;
  setCfInboundForwardTo: React.Dispatch<React.SetStateAction<string>>;
  copied: boolean;
  setCopied: React.Dispatch<React.SetStateAction<boolean>>;
  showCode: boolean;
  setShowCode: React.Dispatch<React.SetStateAction<boolean>>;
  isPending: boolean;
  isTestingEmail: boolean;
  handleTestEmailConfig: () => Promise<void>;
}) {
  const generateWorkerCode = () => {
    return `// WARNING: If you modify this template, make sure to also update the file
// worker/worker.ts to keep them in sync.

export default {
  async email(message, env) {
    if (!env.INBOUND_FORWARD_TO) {
      throw new Error("INBOUND_FORWARD_TO environment variable is not set.");
    }
    await message.forward(env.INBOUND_FORWARD_TO);
    await env.EMAIL.send({
      from: extractRawEmail(message.to),
      to: message.from,
      subject: \`Re: \${message.headers.get("subject") ?? "Your RSVP"}\`,
      text: "Thanks for your reply. The event host has been notified.",
    });
  },

  async fetch(request, env) {
    if (!env.WORKER_API_SECRET) {
      return new Response("Unauthorized: WORKER_API_SECRET environment variable is not set.", { status: 401 });
    }
    if (request.headers.get("Authorization") !== \`Bearer \${env.WORKER_API_SECRET}\`) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (request.method !== "POST" || new URL(request.url).pathname !== "/send") {
      return new Response("Not found", { status: 404 });
    }

    try {
      const body = await request.json();
      if (!body.from || !body.to || !body.subject || (!body.html && !body.text)) {
        return new Response("Missing required fields", { status: 422 });
      }

      const rawFrom = extractRawEmail(body.from);
      const rawReplyTo = body.replyTo ? extractRawEmail(body.replyTo) : undefined;

      const recipients = Array.isArray(body.to) ? body.to : [body.to];
      const bcc = body.bcc ? (Array.isArray(body.bcc) ? body.bcc : [body.bcc]) : [];
      const allRecipients = [...recipients, ...bcc];

      await env.EMAIL.send({
        from: rawFrom,
        to: recipients,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject: body.subject,
        html: body.html || undefined,
        text: body.text || undefined,
        replyTo: rawReplyTo,
      });

      return Response.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal Server Error";
      return new Response(message, { status: 500 });
    }
  },
};

function extractRawEmail(fromStr) {
  const match = fromStr.match(/<([^>]+)>/);
  return match ? match[1].trim() : fromStr.trim();
}
`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Guest Email Channel Toggle */}
      <div
        style={{
          backgroundColor: APP_SHELL.cardBg,
          border: `1px solid ${APP_SHELL.cardBorder}`,
          borderRadius: APP_SHELL.cardRadius,
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: APP_SHELL.textPrimary }}>
              Guest Email Notifications
            </div>
            <div
              style={{
                fontSize: "12px",
                color: APP_SHELL.textSecondary,
                marginTop: "4px",
                maxWidth: "420px",
              }}
            >
              When off, no emails are sent to guests (RSVP confirmations, blasts, reminders,
              invites). Host login links and admin emails are unaffected.
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleEmailEnabled}
            style={{
              width: "50px",
              height: "26px",
              borderRadius: "13px",
              border: "none",
              backgroundColor:
                config.email_enabled !== "false" ? APP_SHELL.accent : "rgba(255,255,255,0.1)",
              cursor: "pointer",
              position: "relative",
              transition: "background-color 0.2s",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                backgroundColor: "#fff",
                position: "absolute",
                top: "3px",
                left: config.email_enabled !== "false" ? "27px" : "3px",
                transition: "left 0.2s",
              }}
            />
          </button>
        </div>
      </div>

      {/* Section 2: Server Configuration & Email Delivery */}
      <div
        style={{
          backgroundColor: APP_SHELL.cardBg,
          border: `1px solid ${APP_SHELL.cardBorder}`,
          borderRadius: APP_SHELL.cardRadius,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: APP_SHELL.textPrimary,
              margin: 0,
            }}
          >
            Server Configuration & Email Delivery
          </h3>
          <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", marginTop: "4px" }}>
            Choose your email provider and configure settings (database config overrides env
            variables).
          </p>
        </div>

        <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

        <form
          onSubmit={handleSaveEmailConfig}
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: APP_SHELL.textSecondary,
                marginBottom: "6px",
              }}
            >
              Email Provider
            </label>
            <select
              value={emailProvider}
              onChange={(e) => setEmailProvider(e.target.value)}
              style={{
                width: "100%",
                backgroundColor: APP_SHELL.inputBg,
                border: `1px solid ${APP_SHELL.inputBorder}`,
                borderRadius: APP_SHELL.inputRadius,
                padding: "10px 14px",
                color: APP_SHELL.textPrimary,
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
                colorScheme: "dark",
              }}
            >
              <option value="console" style={{ backgroundColor: "#12091f", color: "#ffffff" }}>
                Console Fallback (Local Dev / Logging)
              </option>
              <option value="smtp" style={{ backgroundColor: "#12091f", color: "#ffffff" }}>
                SMTP Server
              </option>
              <option value="cloudflare" style={{ backgroundColor: "#12091f", color: "#ffffff" }}>
                Cloudflare Workers
              </option>
              <option
                value="cloudflare_api"
                style={{ backgroundColor: "#12091f", color: "#ffffff" }}
              >
                Cloudflare Email REST API
              </option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: APP_SHELL.textSecondary,
                marginBottom: "6px",
              }}
            >
              From Address
            </label>
            <input
              type="text"
              required
              placeholder="e.g. RSVP to Me <noreply@yourdomain.com>"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              style={{
                width: "100%",
                backgroundColor: APP_SHELL.inputBg,
                border: `1px solid ${APP_SHELL.inputBorder}`,
                borderRadius: APP_SHELL.inputRadius,
                padding: "10px 14px",
                color: APP_SHELL.textPrimary,
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {emailProvider === "smtp" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "16px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: APP_SHELL.textSecondary,
                      marginBottom: "6px",
                    }}
                  >
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. smtp.gmail.com"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    style={{
                      width: "100%",
                      backgroundColor: APP_SHELL.inputBg,
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      borderRadius: APP_SHELL.inputRadius,
                      padding: "10px 14px",
                      color: APP_SHELL.textPrimary,
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: APP_SHELL.textSecondary,
                      marginBottom: "6px",
                    }}
                  >
                    SMTP Port
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="587"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    style={{
                      width: "100%",
                      backgroundColor: APP_SHELL.inputBg,
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      borderRadius: APP_SHELL.inputRadius,
                      padding: "10px 14px",
                      color: APP_SHELL.textPrimary,
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "13px",
                      color: APP_SHELL.textPrimary,
                    }}
                  >
                    Use Secure Connection (SSL/TLS)
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: APP_SHELL.textSecondary,
                      marginTop: "2px",
                    }}
                  >
                    Set true for port 465, false for 587 (STARTTLS).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSmtpSecure((prev) => !prev)}
                  style={{
                    width: "50px",
                    height: "26px",
                    borderRadius: "13px",
                    border: "none",
                    backgroundColor: smtpSecure ? APP_SHELL.accent : "rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background-color 0.2s",
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: "#fff",
                      position: "absolute",
                      top: "3px",
                      left: smtpSecure ? "27px" : "3px",
                      transition: "left 0.2s",
                    }}
                  />
                </button>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: APP_SHELL.textSecondary,
                    marginBottom: "6px",
                  }}
                >
                  SMTP Username (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. user@gmail.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: APP_SHELL.inputBg,
                    border: `1px solid ${APP_SHELL.inputBorder}`,
                    borderRadius: APP_SHELL.inputRadius,
                    padding: "10px 14px",
                    color: APP_SHELL.textPrimary,
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: APP_SHELL.textSecondary,
                    marginBottom: "6px",
                  }}
                >
                  SMTP Password (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: APP_SHELL.inputBg,
                    border: `1px solid ${APP_SHELL.inputBorder}`,
                    borderRadius: APP_SHELL.inputRadius,
                    padding: "10px 14px",
                    color: APP_SHELL.textPrimary,
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          )}

          {emailProvider === "cloudflare_api" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div
                style={{
                  padding: "12px 16px",
                  backgroundColor: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  borderRadius: "8px",
                  color: "#fbbf24",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  display: "flex",
                  gap: "8px",
                  alignItems: "flex-start",
                }}
              >
                <span style={{ fontSize: "16px" }}>⚠️</span>
                <div>
                  <strong>One-Way Outbound Only:</strong> Direct API sending does not deploy any
                  code to Cloudflare. As a result, guest replies to invite emails will not trigger
                  automatic worker-based auto-responses. Any replies will only follow standard email
                  forwarding/routing rules configured in your Cloudflare dashboard.
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: APP_SHELL.textSecondary,
                    marginBottom: "6px",
                  }}
                >
                  Cloudflare Account ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1a2b3c4d5e6f..."
                  value={cfAccountId}
                  onChange={(e) => setCfAccountId(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: APP_SHELL.inputBg,
                    border: `1px solid ${APP_SHELL.inputBorder}`,
                    borderRadius: APP_SHELL.inputRadius,
                    padding: "10px 14px",
                    color: APP_SHELL.textPrimary,
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: APP_SHELL.textSecondary,
                    marginTop: "4px",
                    lineHeight: "1.4",
                  }}
                >
                  Your unique 32-character Cloudflare Account ID. You can find this on your
                  Cloudflare Dashboard homepage (sidebar on the right under{" "}
                  <strong>Account ID</strong>).
                </span>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: APP_SHELL.textSecondary,
                    marginBottom: "6px",
                  }}
                >
                  Cloudflare API Token
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showCfApiToken ? "text" : "password"}
                    required
                    placeholder="Cloudflare API Token"
                    value={cfApiToken}
                    onChange={(e) => setCfApiToken(e.target.value)}
                    style={{
                      width: "100%",
                      backgroundColor: APP_SHELL.inputBg,
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      borderRadius: APP_SHELL.inputRadius,
                      padding: "10px 40px 10px 14px",
                      color: APP_SHELL.textPrimary,
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCfApiToken(!showCfApiToken)}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: APP_SHELL.textSecondary,
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={showCfApiToken ? "Hide token" : "Show token"}
                  >
                    {showCfApiToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: APP_SHELL.textSecondary,
                    marginTop: "4px",
                    lineHeight: "1.4",
                  }}
                >
                  An API Token with <strong>Account &gt; Email Sending: Edit</strong> permissions.
                </span>
              </div>

              <div
                style={{
                  marginTop: "12px",
                  padding: "16px",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <h4
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: APP_SHELL.textPrimary,
                    margin: "0 0 10px 0",
                  }}
                >
                  ⚡ Quick Dashboard Setup (No CLI Required)
                </h4>
                <ol
                  style={{
                    fontSize: "12px",
                    color: APP_SHELL.textSecondary,
                    paddingLeft: "16px",
                    margin: "0",
                    lineHeight: "1.6",
                  }}
                >
                  <li style={{ marginBottom: "6px" }}>
                    Log in to{" "}
                    <a
                      href="https://dash.cloudflare.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: APP_SHELL.accent, textDecoration: "underline" }}
                    >
                      dash.cloudflare.com
                    </a>
                    .
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    In the left sidebar, click on your domain (under <strong>Websites</strong>),
                    then navigate to{" "}
                    <strong>Email &gt; Email Routing &gt; Destination addresses</strong> to verify
                    your email routing is configured.
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Navigate to the <strong>Email Sending</strong> tab on the same page, click{" "}
                    <strong>Configure</strong> or <strong>Get Started</strong>, and authorize the
                    generated DNS records (DKIM/SPF) to allow sending.{" "}
                    <strong>
                      (CRITICAL: If you skip this, major providers like Gmail will reject your
                      emails due to DMARC policies!)
                    </strong>
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Go to <strong>My Profile &gt; API Tokens</strong> (top right user icon &gt; My
                    Profile &gt; API Tokens).
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Click <strong>Create Token</strong>. Scroll to the bottom and click{" "}
                    <strong>Create Custom Token</strong>.
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Give your token a name (e.g., <code>RSVP to Me API Token</code>).
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Under <strong>Permissions</strong>, select:
                    <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                      <li style={{ marginBottom: "4px" }}>
                        <strong>Account</strong> | <strong>Email Sending</strong> |{" "}
                        <strong>Edit</strong>
                      </li>
                    </ul>
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Under <strong>Account Resources</strong>, choose <strong>Include</strong> and
                    select your account. Under <strong>Zone Resources</strong>, choose{" "}
                    <strong>Include</strong> &gt; <strong>Specific zone</strong> &gt; select your
                    domain.
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Click <strong>Continue to summary</strong>, then click{" "}
                    <strong>Create Token</strong>. Copy the token and paste it above!
                  </li>
                </ol>
              </div>
            </div>
          )}

          {emailProvider === "cloudflare" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: APP_SHELL.textSecondary,
                    marginBottom: "6px",
                  }}
                >
                  Cloudflare Worker URL
                </label>
                <input
                  type="url"
                  required
                  placeholder={`https://rsvp-email-worker.${suggestedSubdomain}.workers.dev`}
                  value={cfWorkerUrl}
                  onChange={(e) => setCfWorkerUrl(e.target.value)}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val && !/^https?:\/\//i.test(val)) {
                      setCfWorkerUrl(`https://${val}`);
                    }
                  }}
                  style={{
                    width: "100%",
                    backgroundColor: APP_SHELL.inputBg,
                    border: `1px solid ${APP_SHELL.inputBorder}`,
                    borderRadius: APP_SHELL.inputRadius,
                    padding: "10px 14px",
                    color: APP_SHELL.textPrimary,
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: APP_SHELL.textSecondary,
                    marginTop: "4px",
                    lineHeight: "1.4",
                  }}
                >
                  The public HTTP endpoint of your worker. Usually formatted as{" "}
                  <code>https://rsvp-email-worker.{suggestedSubdomain}.workers.dev</code>. You can
                  find this in your Cloudflare Dashboard under your worker&apos;s{" "}
                  <strong>Triggers</strong> or <strong>Routes</strong> tab.
                </span>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: APP_SHELL.textSecondary,
                    marginBottom: "6px",
                  }}
                >
                  Worker API Secret (WORKER_API_SECRET)
                </label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      type={showSecret ? "text" : "password"}
                      required
                      placeholder="API Secret Token"
                      value={cfWorkerSecret}
                      onChange={(e) => setCfWorkerSecret(e.target.value)}
                      style={{
                        width: "100%",
                        backgroundColor: APP_SHELL.inputBg,
                        border: `1px solid ${APP_SHELL.inputBorder}`,
                        borderRadius: APP_SHELL.inputRadius,
                        padding: "10px 40px 10px 14px",
                        color: APP_SHELL.textPrimary,
                        fontSize: "13px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: APP_SHELL.textSecondary,
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title={showSecret ? "Hide secret" : "Show secret"}
                    >
                      {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(cfWorkerSecret);
                      setSecretCopied(true);
                      setTimeout(() => setSecretCopied(false), 2000);
                    }}
                    disabled={!cfWorkerSecret}
                    style={{
                      backgroundColor: secretCopied ? "#22c55e" : "rgba(255, 255, 255, 0.08)",
                      border: `1px solid ${secretCopied ? "#22c55e" : APP_SHELL.inputBorder}`,
                      borderRadius: APP_SHELL.inputRadius,
                      color: "#fff",
                      padding: "0 14px",
                      height: "38px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: cfWorkerSecret ? "pointer" : "not-allowed",
                      opacity: cfWorkerSecret ? 1 : 0.5,
                      transition: "background-color 0.2s, border-color 0.2s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                    onMouseEnter={(e) => {
                      if (cfWorkerSecret && !secretCopied)
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      if (cfWorkerSecret && !secretCopied)
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                    }}
                    title="Copy secret to clipboard"
                  >
                    {secretCopied ? "✓" : "📋"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const hasSavedSecret = !!config.cloudflare_worker_api_secret;
                      if (hasSavedSecret) {
                        const confirmOverwrite = window.confirm(
                          "Warning: A worker API secret is already saved in the database. Generating a new one will overwrite it. You must also update the WORKER_API_SECRET in your Cloudflare dashboard to match. Are you sure you want to continue?"
                        );
                        if (!confirmOverwrite) return;
                      }
                      const chars =
                        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                      const array = new Uint8Array(32);
                      window.crypto.getRandomValues(array);
                      let secret = "";
                      for (let i = 0; i < array.length; i++) {
                        secret += chars[array[i] % chars.length];
                      }
                      setCfWorkerSecret(secret);
                    }}
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      borderRadius: APP_SHELL.inputRadius,
                      color: APP_SHELL.textPrimary,
                      padding: "0 14px",
                      height: "38px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)")
                    }
                  >
                    ⚡ Generate
                  </button>
                </div>
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: APP_SHELL.textSecondary,
                    marginTop: "4px",
                    lineHeight: "1.4",
                  }}
                >
                  A secure token used to authenticate Next.js requests to your worker. Click{" "}
                  <strong>Generate</strong> to create one, then copy it.
                </span>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: APP_SHELL.textSecondary,
                    marginBottom: "6px",
                  }}
                >
                  Admin Fallback Email (INBOUND_FORWARD_TO)
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@domain.com"
                  value={cfInboundForwardTo}
                  onChange={(e) => setCfInboundForwardTo(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: APP_SHELL.inputBg,
                    border: `1px solid ${APP_SHELL.inputBorder}`,
                    borderRadius: APP_SHELL.inputRadius,
                    padding: "10px 14px",
                    color: APP_SHELL.textPrimary,
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: APP_SHELL.textSecondary,
                    marginTop: "4px",
                    lineHeight: "1.4",
                  }}
                >
                  By default, guest replies go dynamically to each event host&apos;s email (using
                  the Reply-To header). This address is a catch-all fallback used only if a guest
                  replies directly to the From address (e.g., noreply@yourdomain.com). Because
                  Cloudflare Email Routing only forwards to verified destination addresses, this
                  fallback email must be verified in your Cloudflare settings.
                </span>
              </div>

              <div
                style={{
                  marginTop: "12px",
                  padding: "16px",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <h4
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: APP_SHELL.textPrimary,
                    margin: "0 0 10px 0",
                  }}
                >
                  ⚡ Quick Browser Setup (No CLI Required)
                </h4>
                <ol
                  style={{
                    fontSize: "12px",
                    color: APP_SHELL.textSecondary,
                    paddingLeft: "16px",
                    margin: "0 0 16px 0",
                    lineHeight: "1.6",
                  }}
                >
                  <li style={{ marginBottom: "6px" }}>
                    Log in to{" "}
                    <a
                      href="https://dash.cloudflare.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: APP_SHELL.accent, textDecoration: "underline" }}
                    >
                      dash.cloudflare.com
                    </a>{" "}
                    (sign up for a free account if you haven&apos;t already).
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Go to{" "}
                    <strong>
                      Websites &gt; [Your Domain] &gt; Email &gt; Email Routing &gt; Email Workers
                    </strong>
                    .
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Click <strong>Create Email Worker</strong>, name it{" "}
                    <code>rsvp-email-worker</code>, and select <strong>Create my own</strong> (which
                    opens the online code editor).
                  </li>
                  <li style={{ marginBottom: "8px" }}>
                    Click the button below to copy or view the worker code:
                  </li>
                </ol>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginBottom: "12px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generateWorkerCode());
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{
                      backgroundColor: copied ? "#22c55e" : APP_SHELL.accent,
                      border: "none",
                      color: "#fff",
                      borderRadius: "6px",
                      padding: "8px 16px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {copied ? "✓ Copied!" : "📋 Copy Worker Code"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCode(!showCode)}
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      borderRadius: "6px",
                      color: APP_SHELL.textPrimary,
                      padding: "8px 16px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)")
                    }
                  >
                    <span>&lt;/&gt;</span> {showCode ? "Hide Worker Code" : "View Worker Code"}
                  </button>
                </div>

                {showCode && (
                  <div style={{ marginBottom: "12px" }}>
                    <pre
                      style={{
                        margin: 0,
                        padding: "12px",
                        backgroundColor: "rgba(0,0,0,0.3)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        fontSize: "11px",
                        color: "#e2e8f0",
                        overflowX: "auto",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        fontFamily: "monospace",
                        maxHeight: "250px",
                        overflowY: "auto",
                      }}
                    >
                      {generateWorkerCode()}
                    </pre>
                  </div>
                )}

                <ol
                  start={4}
                  style={{
                    fontSize: "12px",
                    color: APP_SHELL.textSecondary,
                    paddingLeft: "16px",
                    margin: "0",
                    lineHeight: "1.6",
                  }}
                >
                  <li style={{ marginBottom: "6px" }}>
                    Delete everything in the Cloudflare editor, paste the copied code, and click{" "}
                    <strong>Save and Deploy</strong>.
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Copy your worker&apos;s public URL (found under your worker&apos;s{" "}
                    <strong>Overview</strong> or <strong>Triggers</strong> tab, e.g.{" "}
                    <code>https://rsvp-email-worker.{suggestedSubdomain}.workers.dev</code>) and
                    paste it into the <strong>Cloudflare Worker URL</strong> input field at the top
                    of this settings page.
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Go to the Cloudflare main dashboard and click on{" "}
                    <strong>Workers & Pages</strong> (left-hand sidebar) &gt; click your worker (
                    <code>rsvp-email-worker</code>) &gt; select the <strong>Settings</strong> tab
                    &gt; select <strong>Variables</strong> in the settings menu.
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Under the <strong>Environment Variables</strong> table:
                    <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                      <li style={{ marginBottom: "4px" }}>
                        Click the <strong>Edit variables</strong> button first (required before you
                        can add or change variables).
                      </li>
                      <li style={{ marginBottom: "4px" }}>
                        Click <strong>Add variable</strong>: set Name to{" "}
                        <code>WORKER_API_SECRET</code>, select Type as <strong>Secret</strong>{" "}
                        (using the dropdown or padlock icon), and paste your{" "}
                        <strong>Worker API Secret</strong> from above.
                      </li>
                      <li style={{ marginBottom: "4px" }}>
                        Click <strong>Add variable</strong> again: set Name to{" "}
                        <code>INBOUND_FORWARD_TO</code>, leave Type as <strong>Text</strong>, and
                        paste your <strong>Admin Fallback Email</strong> (e.g.{" "}
                        <code>{cfInboundForwardTo || "your-email@domain.com"}</code>).
                      </li>
                    </ul>
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Scroll down to the <strong>Bindings</strong> section on the same page:
                    <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                      <li style={{ marginBottom: "4px" }}>
                        Click <strong>Add binding</strong>.
                      </li>
                      <li style={{ marginBottom: "4px" }}>
                        Select <strong>Email Service</strong> from the Type dropdown.
                      </li>
                      <li style={{ marginBottom: "4px" }}>
                        Set the Name to <code>EMAIL</code> (must be all capital letters).
                      </li>
                      <li style={{ marginBottom: "4px" }}>
                        <em>
                          Note: Do not enter anything for Value. Once saved, it will display as a
                          dash (<code>—</code>), which is correct and expected.
                        </em>
                      </li>
                    </ul>
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Click the <strong>Save and deploy</strong> button at the bottom of the page to
                    apply all variables and bindings.
                  </li>
                  <li style={{ marginBottom: "6px" }}>
                    Go to your domain dashboard under{" "}
                    <strong>
                      Websites &gt; [Your Domain] &gt; Email &gt; Email Routing &gt; Routes
                    </strong>
                    , and click <strong>Add Route</strong>:
                    <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                      <li style={{ marginBottom: "4px" }}>
                        <strong>Custom address</strong>: Enter your preferred custom sender address
                        (e.g.,{" "}
                        <code>
                          {emailFrom.match(/<([^>]+)>/)?.[1] || emailFrom || "rsvps@yourdomain.com"}
                        </code>
                        ).
                      </li>
                      <li style={{ marginBottom: "4px" }}>
                        <strong>Action</strong>: Select <strong>Send to Worker</strong>.
                      </li>
                      <li style={{ marginBottom: "4px" }}>
                        <strong>Destination worker</strong>: Select <code>rsvp-email-worker</code>.
                      </li>
                      <li style={{ marginBottom: "4px" }}>
                        Click <strong>Save</strong>.
                      </li>
                    </ul>
                  </li>
                </ol>
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "10px",
            }}
          >
            <button
              type="button"
              disabled={isPending || isTestingEmail}
              onClick={handleTestEmailConfig}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                border: `1px solid ${APP_SHELL.inputBorder}`,
                color: APP_SHELL.textPrimary,
                borderRadius: "10px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: isPending || isTestingEmail ? "not-allowed" : "pointer",
                transition: "background-color 0.2s",
                opacity: isPending || isTestingEmail ? 0.6 : 1,
              }}
            >
              {isTestingEmail ? "Testing..." : "Test Connection"}
            </button>

            <button
              type="submit"
              disabled={isPending || isTestingEmail}
              style={{
                backgroundColor: APP_SHELL.accent,
                border: "none",
                color: "#fff",
                borderRadius: "10px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: isPending || isTestingEmail ? "not-allowed" : "pointer",
                opacity: isPending || isTestingEmail ? 0.6 : 1,
              }}
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
