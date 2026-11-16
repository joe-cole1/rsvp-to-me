import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { redisSet, redisDel, isRedisEnabled } from "@/lib/redis";
import { logSafe } from "./logger";

export interface SessionData {
  userId: string;
  email: string;
  role: "HOST" | "ADMIN" | "GUEST";
  sessionId?: string;
}

export const COOKIE_NAME = "rsvp-session";
export const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
const TTL = SESSION_TTL;

function getPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

interface CachedSession {
  id: string;
  userId: string;
  expiresAt: string;
  userRole: "HOST" | "ADMIN" | "GUEST";
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(COOKIE_NAME)?.value;
  if (!sealed) return null;

  try {
    const session = await unsealData<SessionData>(sealed, {
      password: getPassword(),
      ttl: TTL,
    });
    if (!session || !session.sessionId) return null;

    // PostgreSQL is the revocation and role authority. Redis can be stale after
    // an outage or a concurrent cache fill; it must never resurrect a session.
    const record = await db.session.findUnique({
      where: { id: session.sessionId },
      include: { user: { select: { role: true, email: true, phone: true } } },
    });
    if (
      !record ||
      record.userId !== session.userId ||
      record.expiresAt <= new Date() ||
      (record.user.email === null && record.user.phone === null)
    ) {
      return null;
    }
    session.role = record.user.role;
    session.email = record.user.email ?? record.user.phone ?? session.email;

    return session;
  } catch {
    return null;
  }
}

export async function sealSession(data: SessionData): Promise<string> {
  return sealData(data, { password: getPassword(), ttl: TTL });
}

export async function createSession(data: Omit<SessionData, "sessionId">): Promise<void> {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000);

  // Store the session in the database
  await db.session.create({
    data: {
      id: sessionId,
      token: sessionId,
      userId: data.userId,
      expiresAt,
    },
  });

  // Store in Redis if enabled
  if (isRedisEnabled()) {
    const cacheKey = `session:${sessionId}`;
    const cacheValue: CachedSession = {
      id: sessionId,
      userId: data.userId,
      expiresAt: expiresAt.toISOString(),
      userRole: data.role,
    };
    await redisSet(cacheKey, JSON.stringify(cacheValue), SESSION_TTL);
  }

  const sealed = await sealData({ ...data, sessionId }, { password: getPassword(), ttl: TTL });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.DISABLE_HSTS !== "true",
    sameSite: "lax",
    maxAge: TTL,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(COOKIE_NAME)?.value;
  if (sealed) {
    try {
      const session = await unsealData<SessionData>(sealed, {
        password: getPassword(),
        ttl: TTL,
      });
      if (session?.sessionId) {
        await db.session
          .delete({ where: { id: session.sessionId } })
          .catch(logSafe("destroySession:db-delete"));
        if (isRedisEnabled()) {
          await redisDel(`session:${session.sessionId}`);
        }
      }
    } catch {}
  }
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Invalidate all Redis sessions for a user (e.g. on role change)
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  try {
    const userSessions = await db.session.findMany({
      where: { userId },
      select: { id: true },
    });

    if (isRedisEnabled()) {
      for (const s of userSessions) {
        await redisDel(`session:${s.id}`);
      }
    }
  } catch (err) {
    console.error("[session] Failed to invalidate sessions for user:", err);
  }
}

/** Revoke database credentials even when Redis is unavailable. */
export async function revokeUserSessions(userId: string): Promise<void> {
  const sessions = await db.session.findMany({ where: { userId }, select: { id: true } });
  // Capture keys before removing rows. Revoke authority before best-effort
  // cache cleanup so a Redis outage cannot delay credential revocation.
  await db.session.deleteMany({ where: { userId } });
  await Promise.all(sessions.map(({ id }) => redisDel(`session:${id}`)));
}
