import { cache } from "react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "GUEST" | "HOST" | "ADMIN";
};

/**
 * Cached per-request session user lookup. Both layout and page server
 * components can call this — React deduplicates the DB query within
 * a single render pass.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const dbUser = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, avatarUrl: true, role: true },
  });
  if (!dbUser) return null;
  return {
    id: dbUser.id,
    email: dbUser.email ?? session.email,
    name: dbUser.name,
    avatarUrl: dbUser.avatarUrl,
    role: dbUser.role as "GUEST" | "HOST" | "ADMIN",
  };
});
