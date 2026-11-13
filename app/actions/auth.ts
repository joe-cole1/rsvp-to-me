"use server";

import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { resolveLocale, LOCALE_COOKIE } from "@/i18n/config";
import { getRequestTranslator } from "@/i18n/server";
import {
  createLoginChallenge,
  registerHost,
  isOpenRegistrationActive,
  looksLikePhone,
  normalizeLoginIdentifier,
  loginIdentifierWhere,
  verifySignInCode,
} from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { sendMagicLinkSms } from "@/lib/sms";
import { SendMagicLinkSchema, RegisterHostSchema, VerifySignInCodeSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp, isTrustedIpConfigured } from "@/lib/clientIp";
import { assertCaptcha } from "@/lib/captcha";

export async function sendMagicLinkAction(
  rawIdentifier: string,
  redirect?: string,
  captchaToken?: string | null
): Promise<{ success: boolean; error?: string }> {
  const t = await getRequestTranslator();
  // Validate input
  const parseResult = SendMagicLinkSchema.safeParse({ identifier: rawIdentifier });
  if (!parseResult.success) {
    return { success: false, error: t("Ui.Errors.Auth.invalidIdentifier") };
  }
  const identifier = normalizeLoginIdentifier(parseResult.data.identifier);
  await assertCaptcha("signin", captchaToken);

  // SEC-45: only apply the per-IP limiter when a trusted proxy IP is configured.
  // Without one, getClientIp() collapses to loopback and this becomes a single
  // shared bucket across ALL clients — 20 sign-in attempts anywhere would lock
  // every user out. The per-identifier limiter below is the real protection in
  // that mode (as documented in lib/clientIp.ts); a proxy deployment sets
  // TRUSTED_IP_HEADER to restore per-client granularity.
  if (isTrustedIpConfigured()) {
    const ip = await getClientIp();
    const ipLimit = await rateLimit(`ip:${ip}:magic-link`, 20, 600);
    if (!ipLimit.success) {
      return {
        success: false,
        error: t("Ui.Errors.Auth.ipLimit"),
      };
    }
  }

  // Rate limit by identifier: max 5 per 10 minutes
  const idLimit = await rateLimit(`id:${identifier.toLowerCase()}:magic-link`, 5, 600);
  if (!idLimit.success) {
    return {
      success: false,
      error: t("Ui.Errors.Auth.identifierLimit"),
    };
  }

  const isPhone = looksLikePhone(identifier);
  const challenge = await createLoginChallenge(identifier, redirect);

  // SEC-40: never reveal whether an account exists. When createLoginChallenge returns
  // null (no user for this identifier) we send nothing but return the SAME
  // success response as a real send — otherwise the sign-in screen renders a
  // distinct "sign-in failed" state for unknown identifiers, letting an attacker
  // enumerate registered emails/phones. This refines SEC-14a, which unified the
  // error CODE but still branched success vs. failure on account existence.
  if (!challenge) {
    return { success: true };
  }

  const recipient = await db.user.findUnique({
    where: loginIdentifierWhere(identifier),
    select: { preferredLocale: true },
  });
  const recipientLocale =
    recipient?.preferredLocale != null
      ? resolveLocale(recipient.preferredLocale)
      : resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  try {
    if (isPhone) {
      await sendMagicLinkSms(identifier, challenge.link, recipientLocale, challenge.code);
    } else {
      await sendMagicLinkEmail(identifier, challenge.link, recipientLocale, challenge.code);
    }
  } catch (err) {
    console.error("[auth] Magic link delivery failed:", err);
    return { success: false, error: "auth_failed" };
  }

  return { success: true };
}

export async function registerHostAction(
  rawEmail: string,
  rawName: string,
  rawInviteCode: string,
  captchaToken?: string | null
): Promise<{ success: boolean; error?: string }> {
  const t = await getRequestTranslator();
  // Validate input
  const parseResult = RegisterHostSchema.safeParse({
    email: rawEmail,
    name: rawName,
    inviteCode: rawInviteCode,
  });
  if (!parseResult.success) {
    return { success: false, error: t("Ui.Errors.Auth.invalidRegistration") };
  }

  const { email, name, inviteCode } = parseResult.data;
  await assertCaptcha("register", captchaToken);
  const ip = await getClientIp();

  // Rate limit registration by IP: max 3 per hour
  const ipLimit = await rateLimit(`ip:${ip}:register`, 3, 3600);
  if (!ipLimit.success) {
    return {
      success: false,
      error: t("Ui.Errors.Auth.registrationLimit"),
    };
  }

  const openReg = await isOpenRegistrationActive();
  if (!openReg && (!inviteCode || inviteCode.trim() === "")) {
    return { success: false, error: t("Ui.Errors.Auth.inviteRequired") };
  }

  const result = await registerHost(email, name, inviteCode ?? "");

  if (result.success) {
    const challenge = await createLoginChallenge(email);
    if (challenge) {
      const recipient = await db.user.findUnique({
        where: loginIdentifierWhere(email),
        select: { preferredLocale: true },
      });
      const locale =
        recipient?.preferredLocale != null
          ? resolveLocale(recipient.preferredLocale)
          : resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
      await sendMagicLinkEmail(email, challenge.link, locale, challenge.code);
    }
  }

  return result;
}

// The caller navigates with safeRedirectPath(); echoing a client-supplied
// redirect back from here would only hand it unvalidated input to trust.
export async function verifySignInCodeAction(
  rawIdentifier: string,
  rawCode: string
): Promise<{ success: false; error: string } | { success: true }> {
  const t = await getRequestTranslator();
  // SEC-40: every rejected code challenge has the same public response.
  const failure = { success: false as const, error: t("Ui.Errors.Auth.invalidCode") };
  const parsed = VerifySignInCodeSchema.safeParse({ identifier: rawIdentifier, code: rawCode });
  // Malformed input can never verify, and must not mint arbitrary limiter keys.
  if (!parsed.success) return failure;
  const identifier = normalizeLoginIdentifier(parsed.data.identifier);
  // SEC-45: never turn the loopback fallback into a shared sign-in bucket.
  if (isTrustedIpConfigured()) {
    const ip = await getClientIp();
    if (!(await rateLimit(`ip:${ip}:signin-code`, 20, 600)).success) return failure;
  }
  if (!(await rateLimit(`id:${identifier}:signin-code`, 10, 600)).success) return failure;
  if (!(await verifySignInCode(identifier, parsed.data.code))) return failure;
  return { success: true };
}
