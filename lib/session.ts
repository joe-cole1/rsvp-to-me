import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";

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
  // Only enforce this in production environments
  if (process.env.NODE_ENV === "production" && process.env.OPEN_REGISTRATION !== "true") {
    const inviteCode = process.env.HOST_INVITE_CODE;
    if (!inviteCode || inviteCode === "letmein" || inviteCode === "CHANGE_THIS_TO_A_STRONG_RANDOM_CODE" || inviteCode.length < 10) {
      throw new Error("HOST_INVITE_CODE must be set to a strong random value when OPEN_REGISTRATION is disabled in production.");
    }
  }
}

// Run validation on startup
validateInviteCode();

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

    // Verify sessionId exists in DB and is not expired
    const dbSession = await db.session.findUnique({
      where: { id: session.sessionId },
      include: { user: { select: { role: true } } },
    });

    if (!dbSession || dbSession.expiresAt < new Date()) {
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
      }
    } catch {}
  }
  cookieStore.delete(COOKIE_NAME);
}

