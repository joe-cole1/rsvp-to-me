"use server";

import { createMagicLink, registerHost, isOpenRegistrationActive } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { sendMagicLinkSms } from "@/lib/sms";
import { SendMagicLinkSchema, RegisterHostSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp, isTrustedIpConfigured } from "@/lib/clientIp";

function looksLikePhone(s: string): boolean {
  return /^\+?[\d\s\-().]{7,}$/.test(s.trim()) && s.replace(/\D/g, "").length >= 7;
}

export async function sendMagicLinkAction(
  rawIdentifier: string,
  redirect?: string
): Promise<{ success: boolean; error?: string }> {
  // Validate input
  const parseResult = SendMagicLinkSchema.safeParse({ identifier: rawIdentifier });
  if (!parseResult.success) {
    return { success: false, error: "Invalid email or phone number format." };
  }
  const identifier = parseResult.data.identifier;

  // SEC-35: only apply the per-IP limiter when a trusted proxy IP is configured.
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
        error: "Too many sign-in requests from this IP. Please try again later.",
      };
    }
  }

  // Rate limit by identifier: max 5 per 10 minutes
  const idLimit = await rateLimit(`id:${identifier.toLowerCase()}:magic-link`, 5, 600);
  if (!idLimit.success) {
    return {
      success: false,
      error: "Too many sign-in requests for this email/phone. Please try again later.",
    };
  }

  const isPhone = looksLikePhone(identifier);
  const link = await createMagicLink(identifier, redirect);

  // SEC-35: never reveal whether an account exists. When createMagicLink returns
  // null (no user for this identifier) we send nothing but return the SAME
  // success response as a real send — otherwise the sign-in screen renders a
  // distinct "sign-in failed" state for unknown identifiers, letting an attacker
  // enumerate registered emails/phones. This refines SEC-14a, which unified the
  // error CODE but still branched success vs. failure on account existence.
  if (!link) {
    return { success: true };
  }

  try {
    if (isPhone) {
      const phone = identifier.trim().replace(/[\s\-().]/g, "");
      await sendMagicLinkSms(phone, link);
    } else {
      await sendMagicLinkEmail(identifier.toLowerCase().trim(), link);
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
  rawInviteCode: string
): Promise<{ success: boolean; error?: string }> {
  // Validate input
  const parseResult = RegisterHostSchema.safeParse({
    email: rawEmail,
    name: rawName,
    inviteCode: rawInviteCode,
  });
  if (!parseResult.success) {
    return { success: false, error: "Invalid registration fields." };
  }

  const { email, name, inviteCode } = parseResult.data;
  const ip = await getClientIp();

  // Rate limit registration by IP: max 3 per hour
  const ipLimit = await rateLimit(`ip:${ip}:register`, 3, 3600);
  if (!ipLimit.success) {
    return {
      success: false,
      error: "Too many registration attempts. Please try again in an hour.",
    };
  }

  const openReg = await isOpenRegistrationActive();
  if (!openReg && (!inviteCode || inviteCode.trim() === "")) {
    return { success: false, error: "Invite code is required." };
  }

  const result = await registerHost(email, name, inviteCode ?? "");

  if (result.success) {
    const link = await createMagicLink(email);
    if (link) {
      await sendMagicLinkEmail(email, link);
    }
  }

  return result;
}
