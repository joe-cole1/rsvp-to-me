"use server";

import { createMagicLink, registerHost, isOpenRegistrationActive } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { sendMagicLinkSms } from "@/lib/sms";
import { SendMagicLinkSchema, RegisterHostSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rateLimit";
import { headers } from "next/headers";

function looksLikePhone(s: string): boolean {
  return /^\+?[\d\s\-().]{7,}$/.test(s.trim()) && s.replace(/\D/g, "").length >= 7;
}

async function getClientIp(): Promise<string> {
  const headersList = await headers();

  const trustedHeader = process.env.TRUSTED_IP_HEADER;
  if (trustedHeader) {
    const ip = headersList.get(trustedHeader);
    if (ip) {
      return ip.split(",")[0].trim();
    }
  }

  const cfConnectingIp = headersList.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  const xRealIp = headersList.get("x-real-ip");
  if (xRealIp) {
    return xRealIp.trim();
  }

  const xForwardedFor = headersList.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  return "127.0.0.1";
}

export async function sendMagicLinkAction(
  rawIdentifier: string
): Promise<{ success: boolean; error?: string }> {
  // Validate input
  const parseResult = SendMagicLinkSchema.safeParse({ identifier: rawIdentifier });
  if (!parseResult.success) {
    return { success: false, error: "Invalid email or phone number format." };
  }
  const identifier = parseResult.data.identifier;
  const ip = await getClientIp();

  // Rate limit by IP: max 20 per 10 minutes
  const ipLimit = await rateLimit(`ip:${ip}:magic-link`, 20, 600);
  if (!ipLimit.success) {
    return { success: false, error: "Too many sign-in requests from this IP. Please try again later." };
  }

  // Rate limit by identifier: max 5 per 10 minutes
  const idLimit = await rateLimit(`id:${identifier.toLowerCase()}:magic-link`, 5, 600);
  if (!idLimit.success) {
    return { success: false, error: "Too many sign-in requests for this email/phone. Please try again later." };
  }

  const isPhone = looksLikePhone(identifier);
  const link = await createMagicLink(identifier);

  // Return success even if user not found to prevent user enumeration (M-1)
  if (link) {
    if (isPhone) {
      const phone = identifier.trim().replace(/[\s\-().]/g, "");
      await sendMagicLinkSms(phone, link);
    } else {
      await sendMagicLinkEmail(identifier.toLowerCase().trim(), link);
    }
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
    return { success: false, error: "Too many registration attempts. Please try again in an hour." };
  }

  const openReg = await isOpenRegistrationActive();
  if (!openReg && (!inviteCode || inviteCode.trim() === "")) {
    return { success: false, error: "Invite code is required." };
  }

  const result = await registerHost(email, name, inviteCode ?? "");
  return result;
}

