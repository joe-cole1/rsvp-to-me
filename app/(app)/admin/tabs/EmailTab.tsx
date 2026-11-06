"use client";
import { useTranslations } from "next-intl";

import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { APP_SHELL, APP_SHELL_THEME as T } from "@/lib/theme";
import { appCardStyle } from "@/components/ui/AppPrimitives";
import { Button } from "@/components/ui/Button";
import { Field, Input, SecretInput, Select } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";
import { Toggle } from "@/components/ui/Toggle";
import { EmailTemplatesSection } from "./EmailTemplatesSection";

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rsvp-control"
        style={
          {
            "--rsvp-focus": T.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            ...appCardStyle,
            padding: "16px 24px",
            cursor: "pointer",
            textAlign: "left",
            width: "100%",
          } as React.CSSProperties
        }
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "16px", color: APP_SHELL.textPrimary }}>
            {title}
          </div>
          <div style={{ fontSize: "12px", color: APP_SHELL.textSecondary, marginTop: "2px" }}>
            {subtitle}
          </div>
        </div>
        <ChevronDown
          size={18}
          color={APP_SHELL.textSecondary}
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        />
      </button>
      {open && children}
    </div>
  );
}

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
  cfWorkerUrl,
  setCfWorkerUrl,
  suggestedSubdomain,
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
  cfWorkerUrl: string;
  setCfWorkerUrl: React.Dispatch<React.SetStateAction<string>>;
  suggestedSubdomain: string;
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
  const tr = useTranslations("Ui.Admin");

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
      <CollapsibleSection title={tr("emailSetup")} subtitle={tr("EmailTab.setupSubtitle")}>
        {/* Guest Email Channel Toggle */}
        <div
          style={{
            ...appCardStyle,
            padding: "24px",
          }}
        >
          <Toggle
            theme={T}
            label={tr("guestEmailNotifications")}
            description={tr("whenOffNoEmailsAreSentToGuestsRsvp")}
            value={config.email_enabled !== "false"}
            onChange={handleToggleEmailEnabled}
            style={{ marginBottom: 0 }}
          />
        </div>

        {/* Section 2: Server Configuration & Email Delivery */}
        <div
          style={{
            ...appCardStyle,
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
              {tr("serverConfigurationEmailDelivery")}
            </h3>
            <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", marginTop: "4px" }}>
              {tr("chooseYourEmailProviderAndConfigureSettingsDatabaseConfig")}
            </p>
          </div>

          <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

          <form
            onSubmit={handleSaveEmailConfig}
            style={{ display: "flex", flexDirection: "column" }}
          >
            <Field theme={T} label={tr("emailProvider")}>
              <Select
                theme={T}
                value={emailProvider}
                onChange={(e) => setEmailProvider(e.target.value)}
              >
                <option value="console">{tr("consoleFallbackLocalDevLogging")}</option>
                <option value="smtp">{tr("smtpServer")}</option>
                <option value="cloudflare">{tr("cloudflareWorkers")}</option>
                <option value="cloudflare_api">{tr("cloudflareEmailRestApi")}</option>
              </Select>
            </Field>

            <Field theme={T} label={tr("fromAddress")}>
              <Input
                theme={T}
                type="text"
                required
                placeholder={tr("eGRsvpToMeNoreplyYourdomainCom")}
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
              />
            </Field>

            {emailProvider === "smtp" && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "16px" }}>
                  <Field theme={T} label={tr("smtpHost")}>
                    <Input
                      theme={T}
                      type="text"
                      required
                      placeholder={tr("eGSmtpGmailCom")}
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                    />
                  </Field>
                  <Field theme={T} label={tr("smtpPort")}>
                    <Input
                      theme={T}
                      type="text"
                      required
                      placeholder="587"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                    />
                  </Field>
                </div>

                <Toggle
                  theme={T}
                  label={tr("useSecureConnectionSslTls")}
                  description={tr("setTrueForPort465FalseFor587Starttls")}
                  value={smtpSecure}
                  onChange={setSmtpSecure}
                  style={{ marginBottom: "16px" }}
                />

                <Field theme={T} label={tr("smtpUsernameOptional")}>
                  <Input
                    theme={T}
                    type="text"
                    placeholder={tr("eGUserGmailCom")}
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                  />
                </Field>

                <Field theme={T} label={tr("smtpPasswordOptional")}>
                  <Input
                    theme={T}
                    type="password"
                    placeholder={tr("password")}
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                  />
                </Field>
              </div>
            )}

            {emailProvider === "cloudflare_api" && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <InlineAlert theme={T} tone="warning">
                  {tr.rich("oneWayOutboundOnlyDirectApiSendingDoesMessage", {
                    part0: (chunks) => <strong>{chunks}</strong>,
                  })}
                </InlineAlert>

                <Field
                  theme={T}
                  label={tr("cloudflareAccountId")}
                  hint={tr.rich("yourUnique32CharacterCloudflareAccountIdYouMessage", {
                    part0: (chunks) => <strong>{chunks}</strong>,
                  })}
                >
                  <Input
                    theme={T}
                    type="text"
                    required
                    placeholder={tr("eG1a2b3c4d5e6f")}
                    value={cfAccountId}
                    onChange={(e) => setCfAccountId(e.target.value)}
                  />
                </Field>

                <Field
                  theme={T}
                  label={tr("cloudflareApiToken")}
                  hint={tr.rich("anApiTokenWithAccountGtEmailSendingMessage", {
                    part0: (chunks) => <strong>{chunks}</strong>,
                  })}
                >
                  <SecretInput
                    theme={T}
                    showLabel={tr("showToken")}
                    hideLabel={tr("hideToken")}
                    required
                    placeholder={tr("cloudflareApiToken")}
                    value={cfApiToken}
                    onChange={(e) => setCfApiToken(e.target.value)}
                  />
                </Field>

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
                    {tr("quickDashboardSetupNoCliRequired")}
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
                      {tr.rich("logInToDashCloudflareComMessage", {
                        part0: (chunks) => (
                          <a
                            href="https://dash.cloudflare.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: T.accentText, textDecoration: "underline" }}
                          >
                            {chunks}
                          </a>
                        ),
                      })}
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr.rich("inTheLeftSidebarClickOnYourDomainMessage", {
                        part0: (chunks) => <strong>{chunks}</strong>,
                        part1: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr.rich("navigateToTheEmailSendingTabOnTheMessage", {
                        part0: (chunks) => <strong>{chunks}</strong>,
                        part1: (chunks) => <strong>{chunks}</strong>,
                        part2: (chunks) => <strong>{chunks}</strong>,
                        part3: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr.rich("goToMyProfileGtApiTokensTopMessage", {
                        part0: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr.rich("clickCreateTokenScrollToTheBottomAndMessage", {
                        part0: (chunks) => <strong>{chunks}</strong>,
                        part1: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr.rich("giveYourTokenANameEGRsvpMessage", {
                        part0: (chunks) => <code>{chunks}</code>,
                      })}
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr("under")} <strong>{tr("permissions2")}</strong>
                      {tr("select")}
                      <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                        <li style={{ marginBottom: "4px" }}>
                          {tr.rich("accountEmailSendingEditMessage", {
                            part0: (chunks) => <strong>{chunks}</strong>,
                            part1: (chunks) => <strong>{chunks}</strong>,
                            part2: (chunks) => <strong>{chunks}</strong>,
                          })}
                        </li>
                      </ul>
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr.rich("underAccountResourcesChooseIncludeAndSelectYourMessage", {
                        part0: (chunks) => <strong>{chunks}</strong>,
                        part1: (chunks) => <strong>{chunks}</strong>,
                        part2: (chunks) => <strong>{chunks}</strong>,
                        part3: (chunks) => <strong>{chunks}</strong>,
                        part4: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr.rich("clickContinueToSummaryThenClickCreateTokenMessage", {
                        part0: (chunks) => <strong>{chunks}</strong>,
                        part1: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {emailProvider === "cloudflare" && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <Field
                  theme={T}
                  label={tr("cloudflareWorkerUrl")}
                  hint={tr.rich("thePublicHttpEndpointOfYourWorkerUsuallyMessage", {
                    part0: (chunks) => <code>{chunks}</code>,
                    part1: (chunks) => <strong>{chunks}</strong>,
                    part2: (chunks) => <strong>{chunks}</strong>,
                    value0: suggestedSubdomain,
                  })}
                >
                  <Input
                    theme={T}
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
                  />
                </Field>

                <Field
                  theme={T}
                  label={tr("workerApiSecretWorkerApiSecret")}
                  hint={tr.rich("aSecureTokenUsedToAuthenticateNextJsMessage", {
                    part0: (chunks) => <strong>{chunks}</strong>,
                  })}
                >
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <SecretInput
                        theme={T}
                        showLabel={tr("showSecret")}
                        hideLabel={tr("hideSecret")}
                        required
                        placeholder={tr("apiSecretToken")}
                        value={cfWorkerSecret}
                        onChange={(e) => setCfWorkerSecret(e.target.value)}
                      />
                    </div>

                    <Button
                      theme={T}
                      variant="icon"
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(cfWorkerSecret);
                        setSecretCopied(true);
                        setTimeout(() => setSecretCopied(false), 2000);
                      }}
                      disabled={!cfWorkerSecret}
                      aria-label={tr("copySecretToClipboard")}
                      title={tr("copySecretToClipboard")}
                    >
                      {secretCopied ? (
                        <Check size={16} aria-hidden="true" />
                      ) : (
                        <Copy size={16} aria-hidden="true" />
                      )}
                    </Button>

                    <Button
                      theme={T}
                      variant="secondary"
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
                    >
                      {tr("generate")}
                    </Button>
                  </div>
                </Field>

                <Field
                  theme={T}
                  label={tr("adminFallbackEmailInboundForwardTo")}
                  hint={tr("byDefaultGuestRepliesGoDynamicallyToEachEvent")}
                >
                  <Input
                    theme={T}
                    type="email"
                    required
                    placeholder={tr("eGAdminDomainCom")}
                    value={cfInboundForwardTo}
                    onChange={(e) => setCfInboundForwardTo(e.target.value)}
                  />
                </Field>

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
                    {tr("quickBrowserSetupNoCliRequired")}
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
                      {tr.rich("logInToDashCloudflareComSignUpMessage", {
                        part0: (chunks) => (
                          <a
                            href="https://dash.cloudflare.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: T.accentText, textDecoration: "underline" }}
                          >
                            {chunks}
                          </a>
                        ),
                      })}
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr.rich("goToWebsitesGtYourDomainGtEmailMessage", {
                        part0: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr.rich("clickCreateEmailWorkerNameItRsvpEmailMessage", {
                        part0: (chunks) => <strong>{chunks}</strong>,
                        part1: (chunks) => <code>{chunks}</code>,
                        part2: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      {tr("clickTheButtonBelowToCopyOrViewThe")}
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
                    <Button
                      theme={T}
                      variant="secondary"
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generateWorkerCode());
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? (
                        <Check size={16} aria-hidden="true" />
                      ) : (
                        <Copy size={16} aria-hidden="true" />
                      )}
                      {copied ? tr("copied") : tr("copyWorkerCode")}
                    </Button>

                    <Button
                      theme={T}
                      variant="secondary"
                      type="button"
                      aria-expanded={showCode}
                      onClick={() => setShowCode(!showCode)}
                    >
                      <span aria-hidden="true">{tr("ltGt")}</span>
                      {showCode ? tr("hideWorkerCode") : tr("viewWorkerCode")}
                    </Button>
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
                      {tr.rich("deleteEverythingInTheCloudflareEditorPasteTheMessage", {
                        part0: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr.rich("copyYourWorkerSPublicUrlFoundUnderMessage", {
                        part0: (chunks) => <strong>{chunks}</strong>,
                        part1: (chunks) => <strong>{chunks}</strong>,
                        part2: (chunks) => <code>{chunks}</code>,
                        part3: (chunks) => <strong>{chunks}</strong>,
                        value0: suggestedSubdomain,
                      })}
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr.rich("goToTheCloudflareMainDashboardAndClickMessage", {
                        part0: (chunks) => <strong>{chunks}</strong>,
                        part1: (chunks) => <code>{chunks}</code>,
                        part2: (chunks) => <strong>{chunks}</strong>,
                        part3: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr("underThe")} <strong>{tr("environmentVariables")}</strong> {tr("table")}
                      <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                        <li style={{ marginBottom: "4px" }}>
                          {tr.rich("clickTheEditVariablesButtonFirstRequiredBeforeMessage", {
                            part0: (chunks) => <strong>{chunks}</strong>,
                          })}
                        </li>
                        <li style={{ marginBottom: "4px" }}>
                          {tr.rich("clickAddVariableSetNameToWorkerApiMessage", {
                            part0: (chunks) => <strong>{chunks}</strong>,
                            part1: (chunks) => <code>{chunks}</code>,
                            part2: (chunks) => <strong>{chunks}</strong>,
                            part3: (chunks) => <strong>{chunks}</strong>,
                          })}
                        </li>
                        <li style={{ marginBottom: "4px" }}>
                          {tr("click")} <strong>{tr("addVariable")}</strong> {tr("againSetNameTo")}{" "}
                          <code>{tr("inboundForwardTo")}</code>
                          {tr("leaveTypeAs")} <strong>{tr("text")}</strong>
                          {tr("andPasteYour")} <strong>{tr("adminFallbackEmail")}</strong>{" "}
                          {tr("eG")} <code>{cfInboundForwardTo || "your-email@domain.com"}</code>).
                        </li>
                      </ul>
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr("scrollDownToThe")} <strong>{tr("bindings")}</strong>{" "}
                      {tr("sectionOnTheSamePage")}
                      <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                        <li style={{ marginBottom: "4px" }}>
                          {tr.rich("clickAddBindingMessage", {
                            part0: (chunks) => <strong>{chunks}</strong>,
                          })}
                        </li>
                        <li style={{ marginBottom: "4px" }}>
                          {tr.rich("selectEmailServiceFromTheTypeDropdownMessage", {
                            part0: (chunks) => <strong>{chunks}</strong>,
                          })}
                        </li>
                        <li style={{ marginBottom: "4px" }}>
                          {tr.rich("setTheNameToEmailMustBeAllMessage", {
                            part0: (chunks) => <code>{chunks}</code>,
                          })}
                        </li>
                        <li style={{ marginBottom: "4px" }}>
                          {tr.rich("noteDoNotEnterAnythingForValueOnceMessage", {
                            part0: (chunks) => <em>{chunks}</em>,
                            part1: (chunks) => <code>{chunks}</code>,
                          })}
                        </li>
                      </ul>
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr.rich("clickTheSaveAndDeployButtonAtTheMessage", {
                        part0: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </li>
                    <li style={{ marginBottom: "6px" }}>
                      {tr("goToYourDomainDashboardUnder")}{" "}
                      <strong>{tr("websitesGtYourDomainGtEmailGtEmailRouting2")}</strong>
                      {tr("andClick")} <strong>{tr("addRoute")}</strong>:
                      <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                        <li style={{ marginBottom: "4px" }}>
                          <strong>{tr("customAddress")}</strong>
                          {tr("enterYourPreferredCustomSenderAddressEG")}{" "}
                          <code>
                            {emailFrom.match(/<([^>]+)>/)?.[1] ||
                              emailFrom ||
                              "rsvps@yourdomain.com"}
                          </code>
                          ).
                        </li>
                        <li style={{ marginBottom: "4px" }}>
                          {tr.rich("actionSelectSendToWorkerMessage", {
                            part0: (chunks) => <strong>{chunks}</strong>,
                            part1: (chunks) => <strong>{chunks}</strong>,
                          })}
                        </li>
                        <li style={{ marginBottom: "4px" }}>
                          {tr.rich("destinationWorkerSelectRsvpEmailWorkerMessage", {
                            part0: (chunks) => <strong>{chunks}</strong>,
                            part1: (chunks) => <code>{chunks}</code>,
                          })}
                        </li>
                        <li style={{ marginBottom: "4px" }}>
                          {tr.rich("clickSaveMessage", {
                            part0: (chunks) => <strong>{chunks}</strong>,
                          })}
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
              <Button
                theme={T}
                variant="secondary"
                type="button"
                disabled={isPending || isTestingEmail}
                onClick={handleTestEmailConfig}
              >
                {isTestingEmail ? tr("testing") : tr("testConnection")}
              </Button>

              <Button
                theme={T}
                variant="primary"
                type="submit"
                disabled={isPending || isTestingEmail}
              >
                {tr("saveSettings")}
              </Button>
            </div>
          </form>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={tr("emailTemplates")} subtitle={tr("EmailTab.templatesSubtitle")}>
        <div
          style={{
            ...appCardStyle,
            padding: "24px",
          }}
        >
          <EmailTemplatesSection />
        </div>
      </CollapsibleSection>
    </div>
  );
}
