import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getTranslator } from "@/i18n/server";
import { decryptConfig } from "./crypto";
import { isChannelEnabled, getSystemConfigMap } from "./config";
import { AddRsvpSchema } from "./schemas";
import { httpFailure, unconfirmed } from "./notifications/transport";
import type { NotificationAdapter, NotificationMessage } from "./notifications/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TWILIO_API_BASE_URL = "https://api.twilio.com/2010-04-01";

async function requestTwilioMessage(
  config: {
    sid: string;
    token: string;
    from: string;
    to: string;
    body: string;
  },
  signal?: AbortSignal
): Promise<Response> {
  return fetch(`${TWILIO_API_BASE_URL}/Accounts/${encodeURIComponent(config.sid)}/Messages.json`, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.sid}:${config.token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: config.from,
      To: config.to,
      Body: config.body,
    }),
  });
}

async function createTwilioMessage(
  config: Parameters<typeof requestTwilioMessage>[0]
): Promise<unknown> {
  const response = await requestTwilioMessage(config);
  if (!response.ok) {
    throw new Error(`Twilio Messages API returned HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Resolve the Twilio auth token from admin-panel config (encrypted at rest)
 * first, then the `TWILIO_AUTH_TOKEN` env var. Single source of truth shared by
 * the SMS sender (`resolveSmsConfig`) and the inbound webhook signature check
 * (SEC-26 / SEC-27).
 *
 * SEC-26: the previous inline check only decrypted values prefixed with
 * `"enc:"`, but `encryptConfig` emits `iv:tag:cipher` with no such prefix — so a
 * DB-stored (encrypted) token was passed to Twilio as raw ciphertext and every
 * admin-panel-configured SMS failed auth. `decryptConfig` no-ops on plaintext
 * and fails closed (returns "") on an undecryptable value.
 *
 * Pass the already-fetched `configMap` (from `resolveSmsConfig`'s `findMany`) to
 * avoid a second DB read; the webhook calls it with no argument and does a
 * single `findUnique`.
 */
export async function resolveTwilioAuthToken(configMap?: Record<string, string>): Promise<string> {
  try {
    const map = configMap || (await getSystemConfigMap());
    const stored = map.twilio_auth_token;
    if (stored) return decryptConfig(stored);
  } catch (err) {
    console.error("[sms] Failed to read Twilio auth token from DB, falling back to env:", err);
  }
  return process.env.TWILIO_AUTH_TOKEN || "";
}

async function resolveSmsConfig() {
  try {
    const configMap = await getSystemConfigMap();
    const sid = configMap.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID || "";
    const token = await resolveTwilioAuthToken(configMap);
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
  return createTwilioMessage({ sid, token, from: phone, to, body });
}

export async function testSmsConfig(
  toPhone: string,
  config: { sid: string; token: string; phone: string },
  locale: Locale = DEFAULT_LOCALE
) {
  const t = await getTranslator(locale);
  if (!config.sid || !config.token || !config.phone) {
    return {
      success: false,
      error: t("Sms.configRequired"),
    };
  }
  try {
    await createTwilioMessage({
      sid: config.sid,
      token: config.token,
      from: config.phone,
      to: toPhone,
      body: t("Sms.test"),
    });
    return { success: true };
  } catch (err: unknown) {
    console.error("[sms:config-test] Twilio test SMS failed:", err);
    return {
      success: false,
      error: t("Sms.configFailed"),
    };
  }
}

export async function sendRsvpConfirmationSms(
  to: string,
  opts: {
    locale: Locale;
    guestName: string;
    eventTitle: string;
    eventSlug: string;
    status: "GOING" | "MAYBE" | "NO";
    editToken: string;
  }
) {
  if (!(await isChannelEnabled("sms"))) return;
  return send(to, await renderConfirmationSms(opts));
}

async function renderConfirmationSms(opts: Parameters<typeof sendRsvpConfirmationSms>[1]) {
  const t = await getTranslator(opts.locale);
  const editUrl = `${APP_URL}/e/${opts.eventSlug}/rsvp?token=${opts.editToken}`;
  const statusLabel = t(`Sms.status.${opts.status}`) + (opts.status === "GOING" ? " ✓" : "");
  return (
    t("Sms.confirmation", {
      guestName: opts.guestName,
      status: statusLabel,
      eventTitle: opts.eventTitle,
      editUrl,
    }) +
    "\n" +
    t("Ui.Notifications.manageEvent") +
    ": " +
    `${APP_URL}/e/${opts.eventSlug}/notifications?token=${opts.editToken}`
  );
}

export async function sendMagicLinkSms(to: string, link: string, locale: Locale) {
  if (!(await isChannelEnabled("sms"))) return;
  const t = await getTranslator(locale);
  return send(to, t("Sms.magicLink", { link }));
}

export async function sendEventInviteSms(
  to: string,
  opts: {
    locale: Locale;
    hostName: string;
    eventTitle: string;
    rsvpBaseUrl: string;
    maybeEnabled: boolean;
  }
) {
  if (!(await isChannelEnabled("sms"))) return;
  const t = await getTranslator(opts.locale);
  const maybeClause = opts.maybeEnabled ? t("Sms.maybeClause") : "";
  return send(
    to,
    t("Sms.invite", {
      hostName: opts.hostName,
      eventTitle: opts.eventTitle,
      maybeClause,
      rsvpUrl: `${opts.rsvpBaseUrl}&status=GOING`,
    })
  );
}

export async function sendSmsBlast(
  phones: string[],
  opts: { locale: Locale; eventTitle: string; eventSlug: string; message: string; hostName: string }
) {
  if (!(await isChannelEnabled("sms"))) return 0;
  const body = await renderBlastSms(opts);
  await Promise.allSettled(phones.map((p) => send(p, body)));
  return phones.length;
}

async function renderBlastSms(opts: {
  locale: Locale;
  eventTitle: string;
  eventSlug: string;
  message: string;
  hostName: string;
}) {
  const t = await getTranslator(opts.locale);
  return t("Sms.blast", {
    hostName: opts.hostName,
    eventTitle: opts.eventTitle,
    message: opts.message,
    eventUrl: `${APP_URL}/e/${opts.eventSlug}`,
  });
}

export async function createSmsNotificationAdapter(): Promise<NotificationAdapter> {
  const config = await resolveSmsConfig();
  return {
    channel: "sms",
    kinds: ["event_update", "confirmation", "approval", "host_alert", "connection_verification"],
    available: (await isChannelEnabled("sms")) && !!config.sid && !!config.token && !!config.phone,
    async deliver(message, targets, context) {
      return Promise.all(
        targets.map(async (target) => {
          const parsed = AddRsvpSchema.shape.guestPhone.safeParse(target.destination);
          if (!parsed.success || !parsed.data)
            return { status: "skipped" as const, reason: "invalid_destination" as const };
          const body = await renderNotificationSms(message, target.locale);
          return context.run(async (signal) => {
            if (target.authorize && !(await target.authorize()))
              return { status: "skipped" as const, reason: "unavailable" as const };
            if (signal.aborted) return unconfirmed();
            const response = await requestTwilioMessage(
              {
                sid: config.sid,
                token: config.token,
                from: config.phone,
                to: parsed.data!.trim().replace(/[\s\-().]/g, ""),
                body,
              },
              signal
            );
            if (!response.ok) return httpFailure(response.status);
            const ack: unknown = await response.json();
            if (
              ack &&
              typeof ack === "object" &&
              "sid" in ack &&
              typeof ack.sid === "string" &&
              ack.sid
            ) {
              if ("status" in ack && (ack.status === "failed" || ack.status === "undelivered")) {
                return { status: "failed" as const, reason: "rejected" as const };
              }
              return { status: "accepted" as const };
            }
            return unconfirmed();
          }, unconfirmed);
        })
      );
    },
  };
}

export async function sendApprovalSms(
  to: string,
  opts: { locale: Locale; eventTitle: string; approved: boolean; message?: string }
) {
  if (!(await isChannelEnabled("sms"))) return;
  return send(to, await renderApprovalSms(opts));
}

async function renderApprovalSms(opts: Parameters<typeof sendApprovalSms>[1]) {
  const t = await getTranslator(opts.locale);
  const statusStr = t(opts.approved ? "Sms.approved" : "Sms.declined");
  const msgStr = opts.message ? t("Sms.hostMessage", { message: opts.message }) : "";
  return t("Sms.approval", { eventTitle: opts.eventTitle, decision: statusStr, message: msgStr });
}

export async function sendHostRsvpAlertSms(
  to: string,
  opts: {
    locale: Locale;
    guestName: string;
    status: "GOING" | "MAYBE" | "NO";
    plusOneCount: number;
    note?: string | null;
    eventTitle: string;
    eventSlug: string;
  }
) {
  if (!(await isChannelEnabled("sms"))) return;
  return send(to, await renderHostAlertSms(opts));
}

async function renderHostAlertSms(opts: Parameters<typeof sendHostRsvpAlertSms>[1]) {
  const t = await getTranslator(opts.locale);
  const statusLabel = t(`Sms.status.${opts.status}`);
  const plusStr = opts.plusOneCount > 0 ? ` +${opts.plusOneCount}` : "";
  const noteStr = opts.note?.trim()
    ? ` "${opts.note.trim().slice(0, 60)}${opts.note.trim().length > 60 ? "…" : ""}"`
    : "";
  const guestListUrl = `${APP_URL}/e/${opts.eventSlug}#guests`;
  return t("Sms.hostAlert", {
    guestName: opts.guestName,
    plusStr,
    status: statusLabel,
    eventTitle: opts.eventTitle,
    note: noteStr,
    guestListUrl,
  });
}

async function renderNotificationSms(message: NotificationMessage, locale: Locale) {
  if (message.kind === "confirmation") return renderConfirmationSms({ ...message.options, locale });
  if (message.kind === "approval") return renderApprovalSms({ ...message.options, locale });
  if (message.kind === "host_alert") return renderHostAlertSms({ ...message.options, locale });
  const t = await getTranslator(locale);
  if (message.kind === "connection_verification")
    return t("Notifications.verificationBody", { code: message.code });
  return renderBlastSms({
    locale,
    eventTitle: message.eventTitle,
    eventSlug: message.eventSlug,
    message: message.smsBody ?? message.body,
    hostName: message.hostName ?? t("Email.yourHost"),
  });
}
