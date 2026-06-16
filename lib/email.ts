import nodemailer from "nodemailer";

const FROM = process.env.EMAIL_FROM ?? "RSVP to Me <noreply@example.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

type MailOpts = { to: string | string[]; bcc?: string | string[]; subject: string; html: string };

async function send(opts: MailOpts) {
  const transport = getTransport();
  if (!transport) {
    console.log("[email:dev]", { to: opts.to, subject: opts.subject, html: opts.html });
    return;
  }
  return transport.sendMail({ from: FROM, ...opts });
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
  opts: { guestName: string; hostName: string; eventTitle: string; eventSlug: string; startAt: Date; locationName?: string | null }
) {
  const eventUrl = `${APP_URL}/e/${opts.eventSlug}`;
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
  });
}

export async function sendBlastEmail(
  to: string[],
  opts: { eventTitle: string; eventSlug: string; message: string; hostName: string }
) {
  const eventUrl = `${APP_URL}/e/${opts.eventSlug}`;
  return send({
    to: FROM,
    bcc: to,
    subject: `Update from ${opts.hostName}: ${opts.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <p style="color:#666">A message from ${opts.hostName} about <strong>${opts.eventTitle}</strong>:</p>
        <p style="white-space:pre-line">${opts.message}</p>
        <a href="${eventUrl}" style="display:inline-block;color:#a855f7;text-decoration:none;font-size:14px">View event →</a>
      </div>
    `,
  });
}

export async function sendRsvpConfirmationEmail(
  to: string,
  opts: { guestName: string; eventTitle: string; eventSlug: string; status: "GOING" | "MAYBE" | "NO"; editToken: string; startAt: Date; locationName?: string | null }
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
  });
}
