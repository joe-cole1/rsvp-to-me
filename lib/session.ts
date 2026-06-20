import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { redisGet, redisSet, redisDel, isRedisEnabled } from "@/lib/redis";

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

function validateInviteCode() {
  // Skip during next build phase
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  // Only enforce this in production environments on non-localhost URLs
  if (process.env.NODE_ENV === "production" && process.env.OPEN_REGISTRATION !== "true") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const isLocalhost = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
    if (!isLocalhost) {
      const inviteCode = process.env.HOST_INVITE_CODE;
      if (!inviteCode || inviteCode === "letmein" || inviteCode === "CHANGE_THIS_TO_A_STRONG_RANDOM_CODE" || inviteCode.length < 10) {
        throw new Error("HOST_INVITE_CODE must be set to a strong random value when OPEN_REGISTRATION is disabled in production.");
      }
    }
  }
}

// Run validation on startup
validateInviteCode();

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

    const cacheKey = `session:${session.sessionId}`;
    let dbSession: { id: string; userId: string; expiresAt: Date; user: { role: string } } | null = null;

    if (isRedisEnabled()) {
      const cached = await redisGet(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CachedSession;
          const expiresAtDate = new Date(parsed.expiresAt);
          if (expiresAtDate > new Date()) {
            dbSession = {
              id: parsed.id,
              userId: parsed.userId,
              expiresAt: expiresAtDate,
              user: { role: parsed.userRole },
            };
          }
        } catch (e) {
          console.error("[session] Failed to parse cached session:", e);
        }
      }
    }

    // If cache miss or Redis disabled, read from database
    if (!dbSession) {
      const dbSessionRecord = await db.session.findUnique({
        where: { id: session.sessionId },
        include: { user: { select: { role: true } } },
      });

      if (dbSessionRecord && dbSessionRecord.expiresAt > new Date()) {
        dbSession = {
          id: dbSessionRecord.id,
          userId: dbSessionRecord.userId,
          expiresAt: dbSessionRecord.expiresAt,
          user: { role: dbSessionRecord.user.role },
        };

        // Cache the session in Redis if enabled
        if (isRedisEnabled()) {
          const ttlSeconds = Math.max(0, Math.floor((dbSession.expiresAt.getTime() - Date.now()) / 1000));
          if (ttlSeconds > 0) {
            const cacheValue: CachedSession = {
              id: dbSession.id,
              userId: dbSession.userId,
              expiresAt: dbSession.expiresAt.toISOString(),
              userRole: dbSession.user.role as "HOST" | "ADMIN" | "GUEST",
            };
            await redisSet(cacheKey, JSON.stringify(cacheValue), ttlSeconds);
          }
        }
      }
    }

    if (!dbSession) {
      return null;
    }

    // Sync database role changes with the active session
    if (dbSession.user.role !== session.role) {
      session.role = dbSession.user.role as "HOST" | "ADMIN" | "GUEST";
    }

    const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase().trim();
    if (initialAdminEmail && session.email?.toLowerCase().trim() === initialAdminEmail && session.role !== "ADMIN") {
      const adminCount = await db.user.count({ where: { role: "ADMIN" } });
      if (adminCount === 0) {
        await db.user.update({ where: { id: session.userId }, data: { role: "ADMIN" } });
        session.role = "ADMIN";
        // Evict cache to pick up updated role
        if (isRedisEnabled()) {
          await redisDel(cacheKey);
        }
      }
    }
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

  const sealed = await sealData(
    { ...data, sessionId },
    { password: getPassword(), ttl: TTL }
  );

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
        await db.session.delete({ where: { id: session.sessionId } }).catch(() => {});
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


