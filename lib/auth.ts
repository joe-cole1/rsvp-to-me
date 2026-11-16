import { normalizePhone } from "./phone";
import { RegisterHostSchema } from "@/lib/schemas";
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
import { completeVerifiedAdminSetup, promoteInitialAdmin } from "./admin-promotion";
import { isSafeRedirect } from "./safe-redirect";

const TOKEN_TTL_MINUTES = 15;

export function looksLikePhone(s: string): boolean {
  // Accepts +1234567890 or 10+ digit strings with optional spaces/dashes/parens
  return /^\+?[\d\s\-().]{7,}$/.test(s.trim()) && s.replace(/\D/g, "").length >= 7;
}

export { normalizePhone } from "./phone";

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
  redirect?: string,
  registration?: string
): Promise<{ link: string; code: string } | null> {
  const user = await db.user.findUnique({ where: loginIdentifierWhere(identifier) });
  if (!user) return null;

  const token = randomBytes(32).toString("hex");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  // Serialize resends with verification so only the newest challenge remains active.
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`login-code:${user.id}`}, 0))`;
    const previous = await tx.magicToken.findFirst({
      where: { userId: user.id, type: "LOGIN", used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    await tx.magicToken.updateMany({
      where: { userId: user.id, type: "LOGIN", used: false },
      data: { used: true },
    });
    await tx.magicToken.create({
      data: {
        userId: user.id,
        type: "LOGIN",
        metadata: registration ?? previous?.metadata ?? null,
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

/** Consumption is shared by the HTTP route and programmatic verifier. */
export async function consumeLoginToken(token: string): Promise<User | null> {
  if (token.length > 128) return null;
  const record = await db.magicToken.findUnique({ where: { token: hashToken(token) } });
  if (!record || record.used || record.expiresAt <= new Date() || record.type !== "LOGIN")
    return null;
  const consumed = await db.magicToken.updateMany({
    where: { id: record.id, used: false, type: "LOGIN", expiresAt: { gt: new Date() } },
    data: { used: true },
  });
  if (consumed.count !== 1) return null;
  const user = await db.user.findUnique({ where: { id: record.userId } });
  return user ? applyVerifiedRegistration(user, record.metadata) : null;
}

export async function verifyMagicToken(token: string): Promise<boolean> {
  const user = await consumeLoginToken(token);
  if (!user) return false;
  await completeLoginForUser(user);
  return true;
}

// Registration intent belongs to a short-lived LOGIN challenge, never to the
// unverified account. Resends carry it forward; only proof can apply it.
async function applyVerifiedRegistration(
  user: User,
  metadata: string | null
): Promise<User | null> {
  if (!metadata) return user;
  let intent: { registrationName?: unknown; inviteId?: unknown; initialAdminSetup?: unknown };
  try {
    intent = JSON.parse(metadata);
  } catch {
    return null;
  }
  if (typeof intent.registrationName !== "string") return user;
  const name = RegisterHostSchema.shape.name.parse(intent.registrationName);
  if (intent.initialAdminSetup === true) return completeVerifiedAdminSetup(user.id, name);
  if (user.role !== "GUEST") return user;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    const current = await tx.user.findUnique({ where: { id: user.id } });
    if (!current || current.role !== "GUEST") return current;
    if (typeof intent.inviteId === "string") {
      await tx.$executeRaw`SELECT id FROM "HostInviteCode" WHERE id = ${intent.inviteId} FOR UPDATE`;
      const invite = await tx.hostInviteCode.findUnique({ where: { id: intent.inviteId } });
      if (
        !invite ||
        !invite.active ||
        (invite.expiresAt && invite.expiresAt <= new Date()) ||
        (invite.maxUses !== null && invite.uses >= invite.maxUses)
      )
        return null;
      await tx.hostInviteCode.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      });
    }
    return tx.user.update({ where: { id: user.id }, data: { role: "HOST", name } });
  });
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
    if (!record?.codeHash || record.codeAttempts >= 5) return null;
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
    return matches && consumed.count === 1 ? { metadata: record.metadata } : null;
  });
  if (!verified) return false;
  const verifiedUser = await applyVerifiedRegistration(user, verified.metadata);
  if (!verifiedUser) return false;
  await completeLoginForUser(verifiedUser);
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

  if (!record || record.used || record.expiresAt <= new Date()) {
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

  const consumed = await db.magicToken.updateMany({
    where: {
      id: record.id,
      used: false,
      expiresAt: { gt: new Date() },
      type: { in: ["EMAIL_CHANGE", "PHONE_CHANGE"] },
    },
    data: { used: true },
  });
  if (consumed.count !== 1) return { success: false, error: t("Ui.Errors.Auth.invalidLink") };

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
): Promise<{ success: boolean; error?: string; challenge?: { link: string; code: string } }> {
  const t = await getRequestTranslator();
  const parsed = RegisterHostSchema.parse({ email, name, inviteCode });
  let inviteId: string | undefined;
  if (!(await isOpenRegistrationActive())) {
    const invite = await db.hostInviteCode.findFirst({
      where: {
        code: parsed.inviteCode,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (!invite || (invite.maxUses !== null && invite.uses >= invite.maxUses)) {
      return { success: false, error: t("Ui.Errors.Auth.invalidInvite") };
    }
    inviteId = invite.id;
  }
  // Existing names, roles, RSVP links and invitation usage stay unchanged until
  // the recipient proves ownership. All account states get the same response.
  await db.user.upsert({
    where: { email: parsed.email },
    create: { email: parsed.email, role: "GUEST" },
    update: {},
  });
  const challenge = await createLoginChallenge(
    parsed.email,
    undefined,
    JSON.stringify({ registrationName: parsed.name, ...(inviteId ? { inviteId } : {}) })
  );
  return { success: true, ...(challenge ? { challenge } : {}) };
}
