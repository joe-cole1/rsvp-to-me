import { db } from "@/lib/db";
import nodemailer from "nodemailer";
import { decryptConfig } from "./crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
  replyTo?: string;
};

type WorkerMailOpts = {
  from: string;
  to: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  html: string;
};

async function resolveEmailConfig() {
  const configs = await db.systemConfig.findMany();
  const configMap: Record<string, string> = {};
  for (const c of configs) {
    configMap[c.key] = c.value;
  }

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
  const cfSecret = decryptConfig(configMap.cloudflare_worker_api_secret) || process.env.CLOUDFLARE_WORKER_API_SECRET;
  const cfAccountId = configMap.cloudflare_account_id || process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfApiToken = decryptConfig(configMap.cloudflare_api_token) || process.env.CLOUDFLARE_API_TOKEN;

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

function getSmtpTransport(smtpConfig: { host?: string; port: number; secure: boolean; user?: string; pass?: string }) {
  if (!smtpConfig.host) return null;
  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.user
      ? { user: smtpConfig.user, pass: smtpConfig.pass }
      : undefined,
  });
}

async function sendViaWorker(
  opts: WorkerMailOpts,
  workerConfig: { url?: string; secret?: string }
): Promise<boolean> {
  if (!workerConfig.url || !isSafeWorkerUrl(workerConfig.url)) return false;
  try {
    const res = await fetch(`${workerConfig.url}/send`, { // codeql[js/request-forgery] codeql[js/ssrf]
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
    const res = await fetch(url, { // codeql[js/request-forgery] codeql[js/ssrf]
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
      },
      config.cloudflare
    );
    if (success) return;
  }

  if (config.provider === "cloudflare_api" && config.cloudflare.accountId && config.cloudflare.apiToken) {
    const success = await sendViaRestApi(
      {
        from: config.from,
        to: resolvedTo,
        bcc: opts.bcc,
        replyTo: opts.replyTo,
        subject: opts.subject,
        html: opts.html,
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
    replyTo: opts.replyTo,
  });
}

export async function sendMagicLinkEmail(to: string, magicLink: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[auth:magic-link-fallback] Magic link for ${to} is: ${magicLink}`);
  }

  return send({
    to,
    subject: "Your sign-in link for RSVP to Me",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:8px">Sign in to RSVP to Me</h2>
        <p style="color:#666;margin-bottom:24px">Click the link below to sign in. This link expires in 15 minutes.</p>
        <a href="${magicLink}" style="display:inline-block;background:#a855f7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Sign In
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
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
  }
) {
  const eventUrl = `${APP_URL}/e/${opts.eventSlug}`;
  const dateStr = opts.startAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const maybeBtn = opts.maybeEnabled
    ? `<a href="${opts.rsvpBaseUrl}&status=MAYBE" style="display:inline-block;background:#f59e0b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:8px">Maybe</a>`
    : "";
  return send({
    to,
    subject: `You're invited: ${opts.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <p style="color:#666">Hey ${opts.guestName},</p>
        <h2 style="margin:4px 0">${opts.eventTitle}</h2>
        <p style="color:#666">${dateStr}${opts.locationName ? ` · ${opts.locationName}` : ""}</p>
        <p style="color:#444">Hosted by ${opts.hostName}</p>
        <div style="margin-top:16px">
          <a href="${opts.rsvpBaseUrl}&status=GOING" style="display:inline-block;background:#22c55e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:8px">Going</a>
          ${maybeBtn}
          <a href="${opts.rsvpBaseUrl}&status=NO" style="display:inline-block;background:#ef4444;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Can't Go</a>
        </div>
        <p style="margin-top:12px"><a href="${eventUrl}" style="color:#a855f7;font-size:14px;text-decoration:none">View event details →</a></p>
      </div>
    `,
    replyTo: opts.replyTo,
  });
}

export async function sendApprovalEmail(
  to: string,
  opts: { guestName: string; eventTitle: string; eventSlug: string; approved: boolean; message?: string; replyTo?: string }
) {
  const eventUrl = `${APP_URL}/e/${opts.eventSlug}`;
  const subject = opts.approved ? `RSVP Approved: ${opts.eventTitle}` : `RSVP Declined: ${opts.eventTitle}`;
  const statusHtml = opts.approved
    ? `<h3>Your RSVP is approved!</h3><p>You are officially on the guest list for <strong>${opts.eventTitle}</strong>.</p>`
    : `<h3>RSVP Declined</h3><p>We're sorry, but the host has declined your RSVP for <strong>${opts.eventTitle}</strong>.</p>`;
  const messageHtml = opts.message
    ? `<div style="margin-top:16px;padding:12px;background:#f3f4f6;border-radius:8px;color:#333;font-style:italic">Message from the host: &ldquo;${opts.message}&rdquo;</div>`
    : "";
  return send({
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        ${statusHtml}
        ${messageHtml}
        ${opts.approved ? `<p style="margin-top:16px"><a href="${eventUrl}" style="display:inline-block;background:#a855f7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">View Event</a></p>` : ""}
      </div>
    `,
    replyTo: opts.replyTo,
  });
}

export async function sendBlastEmail(
  to: string[],
  opts: { eventTitle: string; eventSlug: string; message: string; hostName: string; replyTo?: string }
) {
  const eventUrl = `${APP_URL}/e/${opts.eventSlug}`;
  return send({
    to: "FROM",
    bcc: to,
    subject: `Update from ${opts.hostName}: ${opts.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <p style="color:#666">A message from ${opts.hostName} about <strong>${opts.eventTitle}</strong>:</p>
        <p style="white-space:pre-line">${opts.message}</p>
        <a href="${eventUrl}" style="display:inline-block;color:#a855f7;text-decoration:none;font-size:14px">View event →</a>
      </div>
    `,
    replyTo: opts.replyTo,
  });
}

export async function sendRsvpConfirmationEmail(
  to: string,
  opts: { guestName: string; eventTitle: string; eventSlug: string; status: "GOING" | "MAYBE" | "NO"; editToken: string; startAt: Date; locationName?: string | null; replyTo?: string }
) {
  const eventUrl = `${APP_URL}/e/${opts.eventSlug}`;
  const editUrl = `${APP_URL}/e/${opts.eventSlug}/rsvp?token=${opts.editToken}`;
  const dateStr = opts.startAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const statusLabel = opts.status === "GOING" ? "Going" : opts.status === "MAYBE" ? "Maybe" : "Can't Go";
  return send({
    to,
    subject: `RSVP confirmed: ${opts.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2>You're ${statusLabel}!</h2>
        <p><strong>${opts.eventTitle}</strong><br>${dateStr}${opts.locationName ? `<br>${opts.locationName}` : ""}</p>
        <a href="${eventUrl}" style="display:inline-block;background:#a855f7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
          View Event
        </a>
        <p style="margin-top:16px;font-size:14px;color:#999">
          Changed your mind? <a href="${editUrl}" style="color:#a855f7">Update your RSVP</a>
        </p>
      </div>
    `,
    replyTo: opts.replyTo,
  });
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
  }
) {
  const guestListUrl = `${APP_URL}/e/${opts.eventSlug}#guests`;
  const statusLabel = opts.status === "GOING" ? "Going" : opts.status === "MAYBE" ? "Maybe" : "Can't Go";
  const plusStr = opts.plusOneCount > 0 ? ` +${opts.plusOneCount}` : "";
  const noteHtml = opts.note?.trim()
    ? `<p style="margin:12px 0;padding:10px 14px;background:#f5f5f5;border-left:3px solid #a855f7;border-radius:4px;font-size:14px;color:#555">"${opts.note.trim()}"</p>`
    : "";
  return send({
    to,
    subject: `New RSVP: ${opts.guestName} is ${statusLabel} — ${opts.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px">New RSVP on ${opts.eventTitle}</h2>
        <p style="margin:0 0 4px"><strong>${opts.guestName}${plusStr}</strong> — ${statusLabel}</p>
        ${noteHtml}
        <p style="margin:16px 0 8px;font-size:13px;color:#888">Current headcount: ${opts.goingCount} going · ${opts.maybeCount} maybe · ${opts.noCount} can't go</p>
        <a href="${guestListUrl}" style="display:inline-block;background:#a855f7;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
          View Guest List
        </a>
      </div>
    `,
  });
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
  if (config.provider === "cloudflare_api") {
    if (!config.cloudflare.accountId || !config.cloudflare.apiToken) {
      return { success: false, error: "Cloudflare Account ID and API Token are required." };
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${config.cloudflare.accountId}/email/sending/send`;
    if (!isSafeWorkerUrl(url)) {
      return { success: false, error: "Invalid Cloudflare REST API URL." };
    }
    try {
      const res = await fetch(url, { // codeql[js/request-forgery] codeql[js/ssrf]
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.cloudflare.apiToken}`,
        },
        body: JSON.stringify({
          from: config.from,
          to: testTo,
          subject: "Test Email from RSVP to Me",
          html: "<p>This is a test email to verify your Cloudflare REST API email sending configuration. It works!</p>",
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
      return { success: false, error: "Invalid or unsafe Cloudflare Worker URL. Only public HTTPS URLs are allowed." };
    }
    try {
      const res = await fetch(`${config.cloudflare.url}/send`, { // codeql[js/request-forgery] codeql[js/ssrf]
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.cloudflare.secret ?? ""}`,
        },
        body: JSON.stringify({
          from: config.from,
          to: testTo,
          subject: "Test Email from RSVP to Me",
          html: "<p>This is a test email to verify your Cloudflare Worker email routing configuration. It works!</p>",
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
        auth: config.smtp.user
          ? { user: config.smtp.user, pass: config.smtp.pass }
          : undefined,
      });

      // 1. Verify connection/handshake
      await transport.verify();

      // 2. Send the actual email
      await transport.sendMail({
        from: config.from,
        to: testTo,
        subject: "Test Email from RSVP to Me",
        html: "<p>This is a test email to verify your SMTP configuration. It works!</p>",
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
  console.log("[email:dev-test]", { to: testTo, subject: "Test Email from RSVP to Me" });
  return { success: true };
}

