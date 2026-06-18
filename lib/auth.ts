import { randomBytes } from "crypto";
import { db } from "./db";
import { createSession } from "./session";

const TOKEN_TTL_MINUTES = 15;

function looksLikePhone(s: string): boolean {
  // Accepts +1234567890 or 10+ digit strings with optional spaces/dashes/parens
  return /^\+?[\d\s\-().]{7,}$/.test(s.trim()) && s.replace(/\D/g, "").length >= 7;
}

function normalizePhone(s: string): string {
  // Strip spaces/dashes/parens but keep leading +
  return s.trim().replace(/[\s\-().]/g, "");
}

export async function createMagicLink(identifier: string): Promise<string | null> {
  let user;

  if (looksLikePhone(identifier)) {
    const phone = normalizePhone(identifier);
    user = await db.user.findUnique({ where: { phone } });
  } else {
    const email = identifier.toLowerCase().trim();
    user = await db.user.findUnique({ where: { email } });
  }

  if (!user) return null;

  // Invalidate old tokens for this user
  await db.magicToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await db.magicToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/auth/verify?token=${token}`;
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

export async function verifyMagicToken(token: string): Promise<boolean> {
  const record = await db.magicToken.findUnique({ where: { token } });

  if (!record || record.used || record.expiresAt < new Date()) {
    return false;
  }

  await db.magicToken.update({ where: { id: record.id }, data: { used: true } });

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) return false;

  let role = user.role;
  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase().trim();
  if (initialAdminEmail && user.email?.toLowerCase().trim() === initialAdminEmail && user.role !== "ADMIN") {
    await db.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
    role = "ADMIN";
  }

  await createSession({
    userId: user.id,
    email: user.email ?? user.phone ?? "",
    role: role as "HOST" | "ADMIN" | "GUEST",
  });
  return true;
}

export async function verifyChangeToken(
  token: string
): Promise<{ success: boolean; error?: string; type?: "EMAIL" | "PHONE"; newValue?: string }> {
  const record = await db.magicToken.findUnique({ where: { token } });

  if (!record || record.used || record.expiresAt < new Date()) {
    return { success: false, error: "Invalid, used, or expired verification link." };
  }

  if (record.type === "LOGIN") {
    return { success: false, error: "This link is for signing in, not for profile updates." };
  }

  await db.magicToken.update({ where: { id: record.id }, data: { used: true } });

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    return { success: false, error: "User not found." };
  }

  const isEmail = record.type === "EMAIL_CHANGE";
  const newValue = record.metadata;
  if (!newValue) {
    return { success: false, error: "Invalid request metadata." };
  }

  if (isEmail) {
    const existing = await db.user.findFirst({ where: { email: newValue, NOT: { id: user.id } } });
    if (existing) {
      return { success: false, error: "An account with this email already exists." };
    }
    await db.user.update({
      where: { id: user.id },
      data: { email: newValue },
    });
    await db.rSVP.updateMany({
      where: { userId: user.id },
      data: { guestEmail: newValue },
    });
  } else {
    const existing = await db.user.findFirst({ where: { phone: newValue, NOT: { id: user.id } } });
    if (existing) {
      return { success: false, error: "An account with this phone number already exists." };
    }
    await db.user.update({
      where: { id: user.id },
      data: { phone: newValue },
    });
    await db.rSVP.updateMany({
      where: { userId: user.id },
      data: { guestPhone: newValue },
    });
  }

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
  const normalizedEmail = email.toLowerCase().trim();
  const openRegistration = await isOpenRegistrationActive();

  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    if (existing.role === "HOST" || existing.role === "ADMIN") {
      return { success: false, error: "An account with this email already exists. Sign in with a magic link instead." };
    }

    // Upgrade guest to host
    if (openRegistration) {
      await db.user.update({
        where: { id: existing.id },
        data: { name, role: "HOST" },
      });
      return { success: true };
    }

    const now = new Date();
    const validCode = await db.hostInviteCode.findFirst({
      where: {
        code: inviteCode,
        active: true,
        AND: [
          { OR: [{ maxUses: null }, { maxUses: { gt: 0 } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
    });

    if (!validCode) {
      return { success: false, error: "Invalid or expired invite code." };
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

    return { success: true };
  }

  if (openRegistration) {
    await db.user.create({ data: { email: normalizedEmail, name, role: "HOST" } });
    return { success: true };
  }

  const now = new Date();
  const validCode = await db.hostInviteCode.findFirst({
    where: {
      code: inviteCode,
      active: true,
      AND: [
        { OR: [{ maxUses: null }, { maxUses: { gt: 0 } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
  });

  if (!validCode) {
    return { success: false, error: "Invalid or expired invite code." };
  }

  await db.$transaction([
    db.user.create({ data: { email: normalizedEmail, name, role: "HOST" } }),
    db.hostInviteCode.update({
      where: { id: validCode.id },
      data: { uses: { increment: 1 } },
    }),
  ]);

  return { success: true };
}
