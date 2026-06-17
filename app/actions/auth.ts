"use server";

import { createMagicLink, registerHost } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";

export async function sendMagicLinkAction(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const link = await createMagicLink(normalizedEmail);

  if (!link) {
    return { success: false, error: "No account found with that email. Did you RSVP with a different address?" };
  }

  await sendMagicLinkEmail(normalizedEmail, link);
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
