import { db } from "@/lib/db";
import type { Prisma, User } from "@/app/generated/prisma/client";

const realAdminWhere = { role: "ADMIN", id: { not: "system" } } as const;

export function matchesInitialAdminEmail(email?: string | null): boolean {
  const configured = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  return !!configured && !!email && email.trim().toLowerCase() === configured;
}

export async function hasRealAdmin(): Promise<boolean> {
  return (await db.user.count({ where: realAdminWhere })) > 0;
}

async function lockBootstrap(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('initial-admin-bootstrap', 0))`;
}

/** Only call after successful LOGIN proof. SYSTEM never blocks bootstrap. */
export async function promoteInitialAdmin(userId: string, email?: string | null): Promise<boolean> {
  if (!matchesInitialAdminEmail(email) || userId === "system") return false;
  return db.$transaction(async (tx) => {
    await lockBootstrap(tx);
    if ((await tx.user.count({ where: realAdminWhere })) > 0) return false;
    await tx.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
    return true;
  });
}

/** Apply setup intent only after its paired LOGIN challenge has been consumed. */
export async function completeVerifiedAdminSetup(
  userId: string,
  name: string
): Promise<User | null> {
  return db.$transaction(async (tx) => {
    await lockBootstrap(tx);
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.id === "system" || !matchesInitialAdminEmail(user.email)) return null;
    // Another successful proof for this same account may have completed setup.
    if (user.role === "ADMIN") return user;
    if ((await tx.user.count({ where: realAdminWhere })) > 0) return null;
    return tx.user.update({
      where: { id: userId },
      data: { role: "ADMIN", ...(user.role === "GUEST" ? { name } : {}) },
    });
  });
}
