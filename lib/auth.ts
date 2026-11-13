import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/i18n/config";
import { adoptLoginLocale, writeLocaleCookie } from "@/i18n/preferences";
import { getRequestTranslator } from "@/i18n/server";
import { randomBytes, randomInt, timingSafeEqual } from "crypto";
import type { User } from "@/app/generated/prisma/client";
import { db } from "./db";
import { createSession } from "./session";
import { retireChangedAccountConnection } from "@/lib/notifications/lifecycle";
import { hashToken } from "./hash";
import { promoteInitialAdmin } from "./admin-promotion";
import { isSafeRedirect } from "./safe-redirect";

const TOKEN_TTL_MINUTES = 15;

export function looksLikePhone(s: string): boolean {
  // Accepts +1234567890 or 10+ digit strings with optional spaces/dashes/parens
  return /^\+?[\d\s\-().]{7,}$/.test(s.trim()) && s.replace(/\D/g, "").length >= 7;
}

export function normalizePhone(s: string): string {
  // Strip spaces/dashes/parens but keep leading +
  return s.trim().replace(/[\s\-().]/g, "");
}

export { isSafeRedirect };

export function normalizeLoginIdentifier(identifier: string): string {
  return looksLikePhone(identifier) ? normalizePhone(identifier) : identifier.toLowerCase().trim();
}

export function loginIdentifierWhere(identifier: string) {
  const normalized = normalizeLoginIdentifier(identifier);
  return looksLikePhone(identifier) ? { phone: normalized } : { email: normalized };
}

export async function createLoginChallenge(
  identifier: string,
  redirect?: string
): Promise<{ link: string; code: string } | null> {
  const user = await db.user.findUnique({ where: loginIdentifierWhere(identifier) });
  if (!user) return null;

  const token = randomBytes(32).toString("hex");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  // Serialize resends with verification so only the newest challenge remains active.
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`login-code:${user.id}`}, 0))`;
    await tx.magicToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });
    await tx.magicToken.create({
      data: {
        userId: user.id,
        type: "LOGIN",
        token: hashToken(token),
        codeHash: hashToken(code),
        codeAttempts: 0,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
      },
    });
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectSuffix =
    redirect && isSafeRedirect(redirect) ? `&redirect=${encodeURIComponent(redirect)}` : "";
  return { link: `${appUrl}/auth/verify?token=${token}${redirectSuffix}`, code };
}

export async function createMagicLink(
  identifier: string,
  redirect?: string
): Promise<string | null> {
  return (await createLoginChallenge(identifier, redirect))?.link ?? null;
}

export async function isOpenRegistrationActive(): Promise<boolean> {
  try {
    const config = await db.systemConfig.findUnique({ where: { key: "open_registration" } });
    if (config) {
      return config.value === "true";
    }
  } catch (err) {
    console.warn("[auth] Failed to check system config from DB, falling back to env:", err);
  }
  return process.env.OPEN_REGISTRATION === "true";
}

export async function linkRsvpsToUser(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true },
  });
  if (!user) return;

  const emailMatches = user.email ? user.email.toLowerCase().trim() : null;
  const phoneMatches = user.phone ? user.phone.trim().replace(/[\s\-().]/g, "") : null;

  if (!emailMatches && !phoneMatches) return;

  const conditions = [];
  if (emailMatches) {
    conditions.push({ guestEmail: emailMatches });
  }
  if (phoneMatches) {
    conditions.push({ guestPhone: phoneMatches });
  }

  // Update all RSVPs that match email or phone but don't currently point to this user
  if (!db.rSVP) return;

  await db.rSVP.updateMany({
    where: {
      AND: [
        { OR: conditions },
        {
          OR: [{ userId: { not: userId } }, { userId: null }],
        },
      ],
    },
    data: {
      userId: userId,
    },
  });
}

export async function verifyMagicToken(token: string): Promise<boolean> {
  if (token.length > 128) {
    return false;
  }
  const hashedToken = hashToken(token);
  const record = await db.magicToken.findUnique({ where: { token: hashedToken } });

  if (!record || record.used || record.expiresAt <= new Date() || record.type !== "LOGIN") {
    return false;
  }

  const consumed = await db.magicToken.updateMany({
    where: { id: record.id, used: false },
    data: { used: true },
  });
  if (consumed.count !== 1) return false;

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) return false;

  await completeLoginForUser(user);
  return true;
}

export async function completeLoginForUser(user: User): Promise<void> {
  let role = user.role;
  if (role !== "ADMIN") {
    const promoted = await promoteInitialAdmin(user.id, user.email);
    if (promoted) {
      role = "ADMIN";
    }
  }

  const locale = await adoptLoginLocale(user, (await cookies()).get(LOCALE_COOKIE)?.value);
  if (locale) await writeLocaleCookie(locale);

  // Auto-link any matching RSVPs
  await linkRsvpsToUser(user.id);

  await createSession({
    userId: user.id,
    email: user.email ?? user.phone ?? "",
    role: role as "HOST" | "ADMIN" | "GUEST",
  });
}

export async function verifySignInCode(identifier: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const user = await db.user.findUnique({ where: loginIdentifierWhere(identifier) });
  if (!user) return false;

  const verified = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`login-code:${user.id}`}, 0))`;
    const record = await tx.magicToken.findFirst({
      where: {
        userId: user.id,
        type: "LOGIN",
        used: false,
        expiresAt: { gt: new Date() },
        codeHash: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!record?.codeHash || record.codeAttempts >= 5) return false;
    const expected = Buffer.from(record.codeHash);
    const actual = Buffer.from(hashToken(code));
    const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
    const consumed = await tx.magicToken.updateMany({
      where: { id: record.id, used: false },
      data: {
        codeAttempts: { increment: 1 },
        ...(matches || record.codeAttempts + 1 >= 5 ? { used: true } : {}),
      },
    });
    return matches && consumed.count === 1;
  });
  if (!verified) return false;
  await completeLoginForUser(user);
  return true;
}

export async function verifyChangeToken(
  token: string
): Promise<{ success: boolean; error?: string; type?: "EMAIL" | "PHONE"; newValue?: string }> {
  const t = await getRequestTranslator();
  if (token.length > 128) {
    return { success: false, error: t("Ui.Errors.Auth.invalidLink") };
  }
  const hashedToken = hashToken(token);
  const record = await db.magicToken.findUnique({ where: { token: hashedToken } });

  if (!record || record.used || record.expiresAt < new Date()) {
    return { success: false, error: t("Ui.Errors.Auth.invalidLink") };
  }

  if (record.type === "LOGIN") {
    return { success: false, error: t("Ui.Errors.Auth.loginLink") };
  }

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    return { success: false, error: t("Ui.Errors.Auth.userNotFound") };
  }

  const isEmail = record.type === "EMAIL_CHANGE";
  const newValue = record.metadata;
  if (!newValue) {
    return { success: false, error: t("Ui.Errors.Auth.invalidMetadata") };
  }

  // Check for conflicts before consuming the token so it isn't burned on a recoverable error
  if (isEmail) {
    const existing = await db.user.findFirst({ where: { email: newValue, NOT: { id: user.id } } });
    if (existing) {
      return { success: false, error: t("Ui.Errors.Auth.emailExists") };
    }
  } else {
    const existing = await db.user.findFirst({ where: { phone: newValue, NOT: { id: user.id } } });
    if (existing) {
      return { success: false, error: t("Ui.Errors.Auth.phoneExists") };
    }
  }

  await db.magicToken.update({ where: { id: record.id }, data: { used: true } });

  if (isEmail) {
    await db.user.update({
      where: { id: user.id },
      data: { email: newValue },
    });
  } else {
    await db.user.update({
      where: { id: user.id },
      data: { phone: newValue },
    });
  }

  await retireChangedAccountConnection(
    user.id,
    isEmail ? "email" : "sms",
    isEmail ? user.email : user.phone
  );

  // Auto-link any new matching RSVPs
  await linkRsvpsToUser(user.id);

  await createSession({
    userId: user.id,
    email: newValue,
    role: user.role as "HOST" | "ADMIN" | "GUEST",
  });

  return { success: true, type: isEmail ? "EMAIL" : "PHONE", newValue };
}

export async function registerHost(
  email: string,
  name: string,
  inviteCode: string
): Promise<{ success: boolean; error?: string }> {
  const t = await getRequestTranslator();
  const normalizedEmail = email.toLowerCase().trim();
  const openRegistration = await isOpenRegistrationActive();

  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    if (existing.role === "HOST" || existing.role === "ADMIN") {
      return {
        success: false,
        error: t("Ui.Errors.Auth.hostExists"),
      };
    }

    // Upgrade guest to host
    if (openRegistration) {
      await db.user.update({
        where: { id: existing.id },
        data: { name, role: "HOST" },
      });
      await linkRsvpsToUser(existing.id);
      return { success: true };
    }

    const now = new Date();
    const validCode = await db.hostInviteCode.findFirst({
      where: {
        code: inviteCode,
        active: true,
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
    });

    if (!validCode || (validCode.maxUses !== null && validCode.uses >= validCode.maxUses)) {
      return { success: false, error: t("Ui.Errors.Auth.invalidInvite") };
    }

    await db.$transaction([
      db.user.update({
        where: { id: existing.id },
        data: { name, role: "HOST" },
      }),
      db.hostInviteCode.update({
        where: { id: validCode.id },
        data: { uses: { increment: 1 } },
      }),
    ]);

    await linkRsvpsToUser(existing.id);
    return { success: true };
  }

  if (openRegistration) {
    const newUser = await db.user.create({ data: { email: normalizedEmail, name, role: "HOST" } });
    await linkRsvpsToUser(newUser.id);
    return { success: true };
  }

  const now = new Date();
  const validCode = await db.hostInviteCode.findFirst({
    where: {
      code: inviteCode,
      active: true,
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
  });

  if (!validCode || (validCode.maxUses !== null && validCode.uses >= validCode.maxUses)) {
    return { success: false, error: t("Ui.Errors.Auth.invalidInvite") };
  }

  const [newUser] = await db.$transaction([
    db.user.create({ data: { email: normalizedEmail, name, role: "HOST" } }),
    db.hostInviteCode.update({
      where: { id: validCode.id },
      data: { uses: { increment: 1 } },
    }),
  ]);

  await linkRsvpsToUser(newUser.id);
  return { success: true };
}
