"use server";

import { createMagicLink, registerHost } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { sendMagicLinkSms } from "@/lib/sms";

function looksLikePhone(s: string): boolean {
  return /^\+?[\d\s\-().]{7,}$/.test(s.trim()) && s.replace(/\D/g, "").length >= 7;
}

export async function sendMagicLinkAction(
  identifier: string
): Promise<{ success: boolean; error?: string }> {
  const isPhone = looksLikePhone(identifier);
  const link = await createMagicLink(identifier);

  if (!link) {
    return {
      success: false,
      error: isPhone
        ? "No account found with that phone number."
        : "No account found with that email. Did you RSVP with a different address?",
    };
  }

  if (isPhone) {
    const phone = identifier.trim().replace(/[\s\-().]/g, "");
    await sendMagicLinkSms(phone, link);
  } else {
    await sendMagicLinkEmail(identifier.toLowerCase().trim(), link);
  }

  return { success: true };
}

export async function registerHostAction(
  email: string,
  name: string,
  inviteCode: string
): Promise<{ success: boolean; error?: string }> {
  const result = await registerHost(email, name, inviteCode);
  return result;
}
