"use server";

import { ProfileSettingsSchema } from "@/lib/schemas";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { resolveLocale } from "@/i18n/config";
import { getRequestTranslator } from "@/i18n/server";
import { db } from "@/lib/db";
import { withUploadLock, assertUploadExists, releaseUpload } from "@/lib/uploads";
import { getSession, destroySession } from "@/lib/session";
import { getSessionUser } from "@/lib/session-user";
import { scheduleUserDeletion, cancelUserDeletion } from "@/lib/account-deletion";
import { randomBytes } from "crypto";
import { sendMagicLinkEmail } from "@/lib/email";
import { sendMagicLinkSms } from "@/lib/sms";
import { revalidatePath } from "next/cache";
import { hashToken } from "@/lib/hash";
import { assertCaptcha } from "@/lib/captcha";

export async function updateProfileSettings(
  data: {
    name: string;
    avatarUrl?: string | null;
    email?: string;
    phone?: string;
  },
  captchaToken?: string | null
) {
  data = ProfileSettingsSchema.parse(data);
  const t = await getRequestTranslator();
  const sessionUser = await getSessionUser();
  if (!sessionUser) throw new Error(t("Ui.Errors.Profile.unauthorized"));
  await assertCaptcha("profile_edit", captchaToken);

  const user = await db.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) throw new Error(t("Ui.Errors.Profile.userNotFound"));

  // Serialize image assignment with garbage collection. Name-only saves need
  // no file access, and removing an avatar is allowed even if its file is gone.
  if (data.avatarUrl !== undefined) {
    const previous = await withUploadLock(async (tx) => {
      if (data.avatarUrl) await assertUploadExists(data.avatarUrl);
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { avatarUrl: true },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { name: data.name, avatarUrl: data.avatarUrl },
      });
      return current.avatarUrl;
    });
    await releaseUpload(previous);
  } else {
    await db.user.update({ where: { id: user.id }, data: { name: data.name } });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const messages: string[] = [];

  // Check email change
  if (data.email) {
    const newEmail = data.email.toLowerCase().trim();
    if (newEmail !== (user.email ?? "")) {
      // Check if another user already has this email
      const existing = await db.user.findUnique({ where: { email: newEmail } });
      const allowed =
        (await rateLimit(`profile-change:user:${user.id}`, 5, 900)).success &&
        (await rateLimit(`profile-change:email:${hashToken(newEmail)}`, 3, 3600)).success;
      if (existing || !allowed) {
        messages.push(t("Ui.Errors.Profile.emailSent"));
      } else {
        // Invalidate any previous pending email-change tokens
        await db.magicToken.updateMany({
          where: { userId: user.id, type: "EMAIL_CHANGE", used: false },
          data: { used: true },
        });

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
        await sendMagicLinkEmail(newEmail, verifyUrl, resolveLocale(user.preferredLocale)).catch(
          () => {
            logger.warn("Profile email verification delivery failed.");
          }
        );
        messages.push(t("Ui.Errors.Profile.emailSent"));
      }
    }
  }

  // Check phone change
  if (data.phone) {
    const newPhone = data.phone.trim().replace(/[\s\-().]/g, "");
    if (newPhone !== (user.phone ?? "")) {
      const existing = await db.user.findUnique({ where: { phone: newPhone } });
      const allowed =
        (await rateLimit(`profile-change:user:${user.id}`, 5, 900)).success &&
        (await rateLimit(`profile-change:phone:${hashToken(newPhone)}`, 3, 3600)).success;
      if (existing || !allowed) {
        messages.push(t("Ui.Errors.Profile.phoneSent"));
      } else {
        // Invalidate any previous pending phone-change tokens
        await db.magicToken.updateMany({
          where: { userId: user.id, type: "PHONE_CHANGE", used: false },
          data: { used: true },
        });

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
        await sendMagicLinkSms(newPhone, verifyUrl, resolveLocale(user.preferredLocale)).catch(
          () => {
            logger.warn("Profile phone verification delivery failed.");
          }
        );
        messages.push(t("Ui.Errors.Profile.phoneSent"));
      }
    }
  }

  revalidatePath("/profile");
  return { success: true, messages };
}

export async function getUserProfile() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      role: true,
      emailNotifications: true,
      smsNotifications: true,
      notificationChannel: true,
      deletionRequestedAt: true,
      deletionScheduledAt: true,
    },
  });

  return user;
}

export async function requestAccountDeletion() {
  const t = await getRequestTranslator();
  const session = await getSession();
  if (!session) throw new Error(t("Ui.Errors.Profile.unauthorized"));

  const result = await scheduleUserDeletion(session.userId);

  if ("blocked" in result) return result;

  await destroySession();
  return result;
}

export async function cancelMyAccountDeletion() {
  const t = await getRequestTranslator();
  const session = await getSession();
  if (!session) throw new Error(t("Ui.Errors.Profile.unauthorized"));

  await cancelUserDeletion(session.userId);

  revalidatePath("/profile");
  return { success: true };
}
