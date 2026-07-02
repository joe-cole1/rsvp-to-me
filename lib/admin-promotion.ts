import { db } from "@/lib/db";

/**
 * Promotes a user to ADMIN if their email matches INITIAL_ADMIN_EMAIL
 * and there are currently no active ADMINs in the system.
 * Returns true if promotion happened, false otherwise.
 */
export async function promoteInitialAdmin(userId: string, email?: string | null): Promise<boolean> {
  if (!email) return false;

  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase().trim();
  if (initialAdminEmail && email.toLowerCase().trim() === initialAdminEmail) {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount === 0) {
      await db.user.update({
        where: { id: userId },
        data: { role: "ADMIN" },
      });
      return true;
    }
  }
  return false;
}
