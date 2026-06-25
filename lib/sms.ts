import twilio from "twilio";
import { db } from "@/lib/db";
import { decryptConfig } from "./crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function resolveSmsConfig() {
  try {
    const configs = await db.systemConfig.findMany();
    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }
    const sid = configMap.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID || "";
    const tokenEnc = configMap.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN || "";
    const token = tokenEnc.startsWith("enc:") ? decryptConfig(tokenEnc) : tokenEnc;
    const phone = configMap.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || "";
    return { sid, token, phone };
  } catch (err) {
    console.error("[sms] Failed to resolve dynamic SMS config, falling back to environment:", err);
    return {
      sid: process.env.TWILIO_ACCOUNT_SID || "",
      token: process.env.TWILIO_AUTH_TOKEN || "",
      phone: process.env.TWILIO_PHONE_NUMBER || "",
    };
  }
}

async function send(to: string, body: string) {
  const { sid, token, phone } = await resolveSmsConfig();
  if (!sid || !token) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[sms:dev]", { to, body });
    } else {
      console.log("[sms:dev] SMS fallback triggered (Twilio credentials not configured)");
    }
    return;
  }
  const client = twilio(sid, token);
  return client.messages.create({ from: phone, to, body });
}

export async function testSmsConfig(
  toPhone: string,
  config: { sid: string; token: string; phone: string }
) {
  if (!config.sid || !config.token || !config.phone) {
    return {
      success: false,
      error: "Twilio Account SID, Auth Token, and Phone Number are required.",
    };
  }
  try {
    const client = twilio(config.sid, config.token);
    await client.messages.create({
      from: config.phone,
      to: toPhone,
      body: "Test SMS from RSVP to Me. Your SMS configuration is correct!",
    });
    return { success: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Twilio error: ${errMsg}` };
  }
}

export async function sendRsvpConfirmationSms(
  to: string,
  opts: {
    guestName: string;
    eventTitle: string;
    eventSlug: string;
    status: "GOING" | "MAYBE" | "NO";
    editToken: string;
  }
) {
  const editUrl = `${APP_URL}/e/${opts.eventSlug}/rsvp?token=${opts.editToken}`;
  const statusLabel =
    opts.status === "GOING" ? "Going ✓" : opts.status === "MAYBE" ? "Maybe" : "Can't Go";
  return send(
    to,
    `${opts.guestName}, you're ${statusLabel} for ${opts.eventTitle}! Update your RSVP: ${editUrl}`
  );
}

export async function sendMagicLinkSms(to: string, link: string) {
  return send(to, `Your sign-in link for RSVP to Me: ${link}\n(expires in 15 minutes)`);
}

export async function sendEventInviteSms(
  to: string,
  opts: { hostName: string; eventTitle: string; rsvpBaseUrl: string; maybeEnabled: boolean }
) {
  const maybeClause = opts.maybeEnabled ? ", MAYBE to say maybe" : "";
  return send(
    to,
    `${opts.hostName} invited you to ${opts.eventTitle}! Reply YES to confirm, NO to decline${maybeClause}. Or RSVP at: ${opts.rsvpBaseUrl}&status=GOING`
  );
}

export async function sendSmsBlast(
  phones: string[],
  opts: { eventTitle: string; eventSlug: string; message: string; hostName: string }
) {
  const eventUrl = `${APP_URL}/e/${opts.eventSlug}`;
  const body = `${opts.hostName} (${opts.eventTitle}): ${opts.message} ${eventUrl}`;
  await Promise.allSettled(phones.map((p) => send(p, body)));
  return phones.length;
}

export async function sendApprovalSms(
  to: string,
  opts: { eventTitle: string; approved: boolean; message?: string }
) {
  const statusStr = opts.approved ? "approved ✓" : "declined";
  const msgStr = opts.message ? ` Message from host: "${opts.message}"` : "";
  return send(to, `Your RSVP for ${opts.eventTitle} was ${statusStr}.${msgStr}`);
}

export async function sendHostRsvpAlertSms(
  to: string,
  opts: {
    guestName: string;
    status: "GOING" | "MAYBE" | "NO";
    plusOneCount: number;
    note?: string | null;
    eventTitle: string;
    eventSlug: string;
  }
) {
  const statusLabel =
    opts.status === "GOING" ? "Going" : opts.status === "MAYBE" ? "Maybe" : "Can't Go";
  const plusStr = opts.plusOneCount > 0 ? ` +${opts.plusOneCount}` : "";
  const noteStr = opts.note?.trim()
    ? ` "${opts.note.trim().slice(0, 60)}${opts.note.trim().length > 60 ? "…" : ""}"`
    : "";
  const guestListUrl = `${APP_URL}/e/${opts.eventSlug}#guests`;
  return send(
    to,
    `${opts.guestName}${plusStr} RSVP'd ${statusLabel} to ${opts.eventTitle}.${noteStr} View guests: ${guestListUrl}`
  );
}
