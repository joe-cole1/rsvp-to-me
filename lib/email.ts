import { db } from "@/lib/db";
import nodemailer from "nodemailer";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
  const smtpPass = configMap.smtp_pass || process.env.SMTP_PASS;

  const cfUrl = configMap.cloudflare_worker_email_url || process.env.CLOUDFLARE_WORKER_EMAIL_URL;
  const cfSecret = configMap.cloudflare_worker_api_secret || process.env.CLOUDFLARE_WORKER_API_SECRET;

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
  if (!workerConfig.url) return false;
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
  opts: { guestName: string; hostName: string; eventTitle: string; eventSlug: string; startAt: Date; locationName?: string | null; inviteLink?: string; replyTo?: string }
) {
  const eventUrl = opts.inviteLink ?? `${APP_URL}/e/${opts.eventSlug}`;
  const dateStr = opts.startAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return send({
    to,
    subject: `You're invited: ${opts.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <p style="color:#666">Hey ${opts.guestName},</p>
        <h2 style="margin:4px 0">${opts.eventTitle}</h2>
        <p style="color:#666">${dateStr}${opts.locationName ? ` · ${opts.locationName}` : ""}</p>
        <p style="color:#444">Hosted by ${opts.hostName}</p>
        <a href="${eventUrl}" style="display:inline-block;background:#a855f7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
          RSVP Now
        </a>
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
