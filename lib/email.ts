import { createElement } from "react";
import nodemailer from "nodemailer";
import { decryptConfig } from "./crypto";
import { isChannelEnabled, getSystemConfigMap } from "./config";
import { appShellEmailTheme, resolveEmailTheme, type EmailThemeInput } from "./email-theme";
import { getEmailTemplateSettings, mergeWithDefaults } from "./email-settings";
import { renderEmail, substitutePlaceholders } from "@/emails/render";
import { mergedToggles, type TemplateId } from "@/emails/registry";
import type { EventEmailDetails } from "@/emails/components/DetailsCard";
import type { RsvpStatusLabel } from "@/emails/types";
import { InviteEmail } from "@/emails/templates/InviteEmail";
import { RsvpConfirmationEmail } from "@/emails/templates/RsvpConfirmationEmail";
import { ApprovalEmail } from "@/emails/templates/ApprovalEmail";
import { BlastEmail } from "@/emails/templates/BlastEmail";
import { HostRsvpAlertEmail } from "@/emails/templates/HostRsvpAlertEmail";
import { MagicLinkEmail } from "@/emails/templates/MagicLinkEmail";
import { WelcomeEmail } from "@/emails/templates/WelcomeEmail";
import { TestEmail } from "@/emails/templates/TestEmail";
import { formatEventDateTime } from "./calendar";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Admin-editable copy (subject/body with {placeholders}) + structural toggles
 * for a template, resolved from SystemConfig at send time.
 */
async function templateCopy(id: TemplateId, vars: Record<string, string | undefined>) {
  const overrides = await getEmailTemplateSettings(id);
  const merged = mergeWithDefaults(id, overrides);
  return {
    subject: substitutePlaceholders(merged.subject, vars),
    body: substitutePlaceholders(merged.body, vars),
    toggles: mergedToggles(id, overrides),
  };
}

const statusLabel = (status: "GOING" | "MAYBE" | "NO"): RsvpStatusLabel =>
  status === "GOING" ? "Going" : status === "MAYBE" ? "Maybe" : "Can't Go";

function isSafeWorkerUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    // Block localhost, loopback, private networks, and link-local metadata addresses
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^(172\.(1[6-9]|2[0-9]|3[0-1]))\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

type MailOpts = {
  to: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

type WorkerMailOpts = {
  from: string;
  to: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
};

async function resolveEmailConfig() {
  const configMap = await getSystemConfigMap();

  const from = configMap.email_from || process.env.EMAIL_FROM || "RSVP to Me <noreply@example.com>";

  let provider = configMap.email_provider;
  if (!provider) {
    if (process.env.CLOUDFLARE_WORKER_EMAIL_URL) {
      provider = "cloudflare";
    } else if (process.env.SMTP_HOST) {
      provider = "smtp";
    } else {
      provider = "console";
    }
  }

  const smtpHost = configMap.smtp_host || process.env.SMTP_HOST;
  const smtpPort = parseInt(configMap.smtp_port || process.env.SMTP_PORT || "587");
  const smtpSecure = (configMap.smtp_secure || process.env.SMTP_SECURE) === "true";
  const smtpUser = configMap.smtp_user || process.env.SMTP_USER;
  const smtpPass = decryptConfig(configMap.smtp_pass) || process.env.SMTP_PASS;

  const cfUrl = configMap.cloudflare_worker_email_url || process.env.CLOUDFLARE_WORKER_EMAIL_URL;
  const cfSecret =
    decryptConfig(configMap.cloudflare_worker_api_secret) ||
    process.env.CLOUDFLARE_WORKER_API_SECRET;
  const cfAccountId = configMap.cloudflare_account_id || process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfApiToken =
    decryptConfig(configMap.cloudflare_api_token) || process.env.CLOUDFLARE_API_TOKEN;

  return {
    provider,
    from,
    smtp: {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      user: smtpUser,
      pass: smtpPass,
    },
    cloudflare: {
      url: cfUrl,
      secret: cfSecret,
      accountId: cfAccountId,
      apiToken: cfApiToken,
    },
  };
}

function getSmtpTransport(smtpConfig: {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}) {
  if (!smtpConfig.host) return null;
  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.user ? { user: smtpConfig.user, pass: smtpConfig.pass } : undefined,
  });
}

async function sendViaWorker(
  opts: WorkerMailOpts,
  workerConfig: { url?: string; secret?: string }
): Promise<boolean> {
  if (!workerConfig.url || !isSafeWorkerUrl(workerConfig.url)) return false;
  try {
    const res = await fetch(`${workerConfig.url}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerConfig.secret ?? ""}`,
      },
      body: JSON.stringify(opts),
    });
    if (!res.ok) {
      console.error("[email:worker] send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email:worker] fetch error:", err);
    return false;
  }
}

async function sendViaRestApi(
  opts: WorkerMailOpts,
  cloudflareApi: { accountId?: string; apiToken?: string }
): Promise<boolean> {
  if (!cloudflareApi.accountId || !cloudflareApi.apiToken) {
    console.error("[email:rest-api] accountId or apiToken is missing");
    return false;
  }
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${cloudflareApi.accountId}/email/sending/send`;
    if (!isSafeWorkerUrl(url)) return false;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cloudflareApi.apiToken}`,
      },
      body: JSON.stringify({
        from: opts.from,
        to: opts.to,
        bcc: opts.bcc,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        replyTo: opts.replyTo,
      }),
    });
    if (!res.ok) {
      console.error("[email:rest-api] send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email:rest-api] fetch error:", err);
    return false;
  }
}

async function send(opts: MailOpts) {
  const config = await resolveEmailConfig();
  const resolvedTo = opts.to === "FROM" ? config.from : opts.to;

  if (config.provider === "cloudflare" && config.cloudflare.url) {
    const success = await sendViaWorker(
      {
        from: config.from,
        to: resolvedTo,
        bcc: opts.bcc,
        replyTo: opts.replyTo,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      },
      config.cloudflare
    );
    if (success) return;
  }

  if (
    config.provider === "cloudflare_api" &&
    config.cloudflare.accountId &&
    config.cloudflare.apiToken
  ) {
    const success = await sendViaRestApi(
      {
        from: config.from,
        to: resolvedTo,
        bcc: opts.bcc,
        replyTo: opts.replyTo,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      },
      config.cloudflare
    );
    if (success) return;
  }

  const transport = getSmtpTransport(config.smtp);
  if (!transport) {
    console.log("[email:dev]", { to: resolvedTo, subject: opts.subject, html: opts.html });
    return;
  }
  return transport.sendMail({
    from: config.from,
    to: resolvedTo,
    bcc: opts.bcc,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
  });
}

/**
 * Send an already-rendered email through the configured transport. Used by the
 * admin/host template test-sends, which render via the registry themselves.
 */
export async function sendRenderedEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  return send(opts);
}

export async function sendMagicLinkEmail(to: string, magicLink: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[auth:magic-link-fallback] Magic link for ${to} is: ${magicLink}`);
  }

  const { subject, body } = await templateCopy("magicLink", {});
  const { html, text } = await renderEmail(
    createElement(MagicLinkEmail, { theme: appShellEmailTheme(), body, magicLink })
  );
  return send({ to, subject, html, text });
}

export async function sendWelcomeEmail(to: string, magicLink: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[admin:welcome-email] Welcome link for ${to} is: ${magicLink}`);
  }

  const { subject, body } = await templateCopy("welcome", {});
  const { html, text } = await renderEmail(
    createElement(WelcomeEmail, { theme: appShellEmailTheme(), body, magicLink })
  );
  return send({ to, subject, html, text });
}

export type EventEmailContext = {
  theme?: EmailThemeInput | null;
  eventId?: string;
  endAt?: Date | null;
  timezone?: string;
  locationAddress?: string | null;
  locationType?: "PHYSICAL" | "VIRTUAL" | "TBD";
  virtualUrl?: string | null;
};

function eventDetails(
  opts: {
    eventTitle: string;
    eventSlug: string;
    startAt: Date;
    locationName?: string | null;
  } & EventEmailContext
): EventEmailDetails {
  return {
    id: opts.eventId ?? opts.eventSlug,
    slug: opts.eventSlug,
    title: opts.eventTitle,
    startAt: opts.startAt,
    endAt: opts.endAt ?? null,
    timezone: opts.timezone,
    locationType: opts.locationType,
    locationName: opts.locationName ?? null,
    locationAddress: opts.locationAddress ?? null,
    virtualUrl: opts.virtualUrl ?? null,
  };
}

export async function sendEventInviteEmail(
  to: string,
  opts: {
    guestName: string;
    hostName: string;
    eventTitle: string;
    eventSlug: string;
    startAt: Date;
    locationName?: string | null;
    rsvpBaseUrl: string;
    maybeEnabled: boolean;
    replyTo?: string;
  } & EventEmailContext
) {
  if (!(await isChannelEnabled("email"))) return;
  const eventUrl = `${APP_URL}/e/${opts.eventSlug}`;
  const event = eventDetails(opts);
  const { subject, body, toggles } = await templateCopy("invite", {
    guestName: opts.guestName,
    hostName: opts.hostName,
    eventTitle: opts.eventTitle,
    eventDate: formatEventDateTime(opts.startAt, opts.endAt, opts.timezone).date,
    location: opts.locationName ?? "",
  });
  const { html, text } = await renderEmail(
    createElement(InviteEmail, {
      theme: resolveEmailTheme(opts.theme),
      body,
      toggles,
      event,
      hostName: opts.hostName,
      rsvpBaseUrl: opts.rsvpBaseUrl,
      maybeEnabled: opts.maybeEnabled,
      eventUrl,
    })
  );
  return send({ to, subject, html, text, replyTo: opts.replyTo });
}

export async function sendApprovalEmail(
  to: string,
  opts: {
    guestName: string;
    eventTitle: string;
    eventSlug: string;
    approved: boolean;
    message?: string;
    replyTo?: string;
    theme?: EmailThemeInput | null;
  }
) {
  if (!(await isChannelEnabled("email"))) return;
  const eventUrl = `${APP_URL}/e/${opts.eventSlug}`;
  const { subject, toggles } = await templateCopy("approval", {
    guestName: opts.guestName,
    eventTitle: opts.eventTitle,
    decision: opts.approved ? "Approved" : "Declined",
  });
  const { html, text } = await renderEmail(
    createElement(ApprovalEmail, {
      theme: resolveEmailTheme(opts.theme),
      toggles,
      eventTitle: opts.eventTitle,
      approved: opts.approved,
      hostMessage: opts.message,
      eventUrl,
    })
  );
  return send({ to, subject, html, text, replyTo: opts.replyTo });
}

export async function sendBlastEmail(
  to: string[],
  opts: {
    eventTitle: string;
    eventSlug: string;
    message: string;
    hostName: string;
    replyTo?: string;
    theme?: EmailThemeInput | null;
  }
) {
  if (!(await isChannelEnabled("email"))) return;
  const eventUrl = `${APP_URL}/e/${opts.eventSlug}`;
  const { subject, toggles } = await templateCopy("blast", {
    hostName: opts.hostName,
    eventTitle: opts.eventTitle,
  });
  const { html, text } = await renderEmail(
    createElement(BlastEmail, {
      theme: resolveEmailTheme(opts.theme),
      toggles,
      eventTitle: opts.eventTitle,
      hostName: opts.hostName,
      message: opts.message,
      eventUrl,
    })
  );
  return send({ to: "FROM", bcc: to, subject, html, text, replyTo: opts.replyTo });
}

export async function sendRsvpConfirmationEmail(
  to: string,
  opts: {
    guestName: string;
    eventTitle: string;
    eventSlug: string;
    status: "GOING" | "MAYBE" | "NO";
    editToken: string;
    startAt: Date;
    locationName?: string | null;
    replyTo?: string;
  } & EventEmailContext
) {
  if (!(await isChannelEnabled("email"))) return;
  const eventUrl = `${APP_URL}/e/${opts.eventSlug}`;
  const editUrl = `${APP_URL}/e/${opts.eventSlug}/rsvp?token=${opts.editToken}`;
  const label = statusLabel(opts.status);
  const event = eventDetails(opts);
  const { subject, body, toggles } = await templateCopy("rsvpConfirmation", {
    guestName: opts.guestName,
    eventTitle: opts.eventTitle,
    eventDate: formatEventDateTime(opts.startAt, opts.endAt, opts.timezone).date,
    location: opts.locationName ?? "",
    status: label,
  });
  const { html, text } = await renderEmail(
    createElement(RsvpConfirmationEmail, {
      theme: resolveEmailTheme(opts.theme),
      body,
      toggles,
      event,
      statusLabel: label,
      eventUrl,
      editUrl,
    })
  );
  return send({ to, subject, html, text, replyTo: opts.replyTo });
}

export async function sendHostRsvpAlertEmail(
  to: string,
  opts: {
    guestName: string;
    status: "GOING" | "MAYBE" | "NO";
    plusOneCount: number;
    note?: string | null;
    eventTitle: string;
    eventSlug: string;
    goingCount: number;
    maybeCount: number;
    noCount: number;
    theme?: EmailThemeInput | null;
  }
) {
  const guestListUrl = `${APP_URL}/e/${opts.eventSlug}#guests`;
  const label = statusLabel(opts.status);
  const { subject } = await templateCopy("hostRsvpAlert", {
    guestName: opts.guestName,
    status: label,
    eventTitle: opts.eventTitle,
  });
  const { html, text } = await renderEmail(
    createElement(HostRsvpAlertEmail, {
      theme: resolveEmailTheme(opts.theme),
      guestName: opts.guestName,
      statusLabel: label,
      plusOneCount: opts.plusOneCount,
      note: opts.note,
      eventTitle: opts.eventTitle,
      goingCount: opts.goingCount,
      maybeCount: opts.maybeCount,
      noCount: opts.noCount,
      guestListUrl,
    })
  );
  return send({ to, subject, html, text });
}

export async function testEmailConfig(
  testTo: string,
  config: {
    provider: string;
    from: string;
    smtp: {
      host?: string;
      port: number;
      secure: boolean;
      user?: string;
      pass?: string;
    };
    cloudflare: {
      url?: string;
      secret?: string;
      accountId?: string;
      apiToken?: string;
    };
  }
): Promise<{ success: boolean; error?: string }> {
  const { subject, body } = await templateCopy("test", {});
  const { html, text } = await renderEmail(
    createElement(TestEmail, { theme: appShellEmailTheme(), body })
  );

  if (config.provider === "cloudflare_api") {
    if (!config.cloudflare.accountId || !config.cloudflare.apiToken) {
      return { success: false, error: "Cloudflare Account ID and API Token are required." };
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${config.cloudflare.accountId}/email/sending/send`;
    if (!isSafeWorkerUrl(url)) {
      return { success: false, error: "Invalid Cloudflare REST API URL." };
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.cloudflare.apiToken}`,
        },
        body: JSON.stringify({
          from: config.from,
          to: testTo,
          subject,
          html,
          text,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          error: `Cloudflare REST API returned status ${res.status}: ${errorText || "No response body"}`,
        };
      }
      return { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Failed to connect to Cloudflare REST API: ${errMsg}`,
      };
    }
  }

  if (config.provider === "cloudflare") {
    if (!config.cloudflare.url || !isSafeWorkerUrl(config.cloudflare.url)) {
      return {
        success: false,
        error: "Invalid or unsafe Cloudflare Worker URL. Only public HTTPS URLs are allowed.",
      };
    }
    try {
      const res = await fetch(`${config.cloudflare.url}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.cloudflare.secret ?? ""}`,
        },
        body: JSON.stringify({
          from: config.from,
          to: testTo,
          subject,
          html,
          text,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          error: `Cloudflare Worker returned status ${res.status}: ${errorText || "No response body"}`,
        };
      }
      return { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Failed to connect to Cloudflare Worker: ${errMsg}`,
      };
    }
  }

  if (config.provider === "smtp") {
    if (!config.smtp.host) {
      return { success: false, error: "SMTP Host is not configured." };
    }
    try {
      const transport = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      });

      // 1. Verify connection/handshake
      await transport.verify();

      // 2. Send the actual email
      await transport.sendMail({
        from: config.from,
        to: testTo,
        subject,
        html,
        text,
      });

      return { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `SMTP error: ${errMsg}`,
      };
    }
  }

  // console provider fallback
  console.log("[email:dev-test]", { to: testTo, subject });
  return { success: true };
}
