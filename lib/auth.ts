import { randomBytes } from "crypto";
import { db } from "./db";
import { createSession } from "./session";

const TOKEN_TTL_MINUTES = 15;

export async function createMagicLink(email: string): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await db.user.findUnique({ where: { email: normalizedEmail } });
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

export async function verifyMagicToken(token: string): Promise<boolean> {
  const record = await db.magicToken.findUnique({ where: { token } });

  if (!record || record.used || record.expiresAt < new Date()) {
    return false;
  }

  await db.magicToken.update({ where: { id: record.id }, data: { used: true } });

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) return false;

  await createSession({ userId: user.id, email: user.email });
  return true;
}

export async function registerHost(
  email: string,
  name: string,
  inviteCode: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

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

  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    if (!existing.name) {
      await db.user.update({ where: { id: existing.id }, data: { name } });
    }
    return { success: false, error: "An account with this email already exists. Sign in with a magic link instead." };
  }

  await db.$transaction([
    db.user.create({ data: { email: normalizedEmail, name } }),
    db.hostInviteCode.update({
      where: { id: validCode.id },
      data: { uses: { increment: 1 } },
    }),
  ]);

  return { success: true };
}
