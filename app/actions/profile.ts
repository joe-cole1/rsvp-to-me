"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { randomBytes } from "crypto";
import { sendMagicLinkEmail } from "@/lib/email";
import { sendMagicLinkSms } from "@/lib/sms";
import { revalidatePath } from "next/cache";
import { hashToken } from "@/lib/hash";

export async function updateProfileSettings(data: {
  name: string;
  avatarUrl?: string | null;
  email?: string;
  phone?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) throw new Error("User not found");

  // Update name and avatar immediately
  await db.user.update({
    where: { id: user.id },
    data: {
      name: data.name,
      avatarUrl: data.avatarUrl,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const messages: string[] = [];

  // Check email change
  if (data.email) {
    const newEmail = data.email.toLowerCase().trim();
    if (newEmail !== (user.email ?? "")) {
      // Check if another user already has this email
      const existing = await db.user.findUnique({ where: { email: newEmail } });
      if (existing) {
        throw new Error("An account with this email already exists.");
      }

      // Generate verification token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      const hashedToken = hashToken(token);

      await db.magicToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt,
          type: "EMAIL_CHANGE",
          metadata: newEmail,
        },
      });

      const verifyUrl = `${appUrl}/auth/verify-change?token=${token}`;
      await sendMagicLinkEmail(newEmail, verifyUrl);
      messages.push("A verification link has been sent to your new email address. Please click it to confirm the change.");
    }
  }

  // Check phone change
  if (data.phone) {
    const newPhone = data.phone.trim().replace(/[\s\-().]/g, "");
    if (newPhone !== (user.phone ?? "")) {
      const existing = await db.user.findUnique({ where: { phone: newPhone } });
      if (existing) {
        throw new Error("An account with this phone number already exists.");
      }

      // Generate verification token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const hashedToken = hashToken(token);

      await db.magicToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt,
          type: "PHONE_CHANGE",
          metadata: newPhone,
        },
      });

      const verifyUrl = `${appUrl}/auth/verify-change?token=${token}`;
      await sendMagicLinkSms(newPhone, verifyUrl);
      messages.push("A verification link has been sent to your new phone number. Please click it to confirm the change.");
    }
  }

  revalidatePath("/profile");
  return { success: true, messages };
}

export async function updateNotificationSettings(data: {
  emailNotifications: boolean;
  smsNotifications: boolean;
}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await db.user.update({
    where: { id: session.userId },
    data: {
      emailNotifications: data.emailNotifications,
      smsNotifications: data.smsNotifications,
    },
  });

  revalidatePath("/profile");
  return { success: true };
}

export async function getUserProfile() {
  const session = await getSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      role: true,
      emailNotifications: true,
      smsNotifications: true,
    },
  });

  if (user) {
    const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase().trim();
    if (initialAdminEmail && user.email?.toLowerCase().trim() === initialAdminEmail && user.role !== "ADMIN") {
      await db.user.update({
        where: { id: user.id },
        data: { role: "ADMIN" },
      });
      user.role = "ADMIN";
    }
  }

  return user;
}
