import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId: string;
  email: string;
  role: "HOST" | "ADMIN" | "GUEST";
}

export const COOKIE_NAME = "rsvp-session";
export const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days
const TTL = SESSION_TTL;

function getPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(COOKIE_NAME)?.value;
  if (!sealed) return null;

  try {
    return await unsealData<SessionData>(sealed, {
      password: getPassword(),
      ttl: TTL,
    });
  } catch {
    return null;
  }
}

export async function sealSession(data: SessionData): Promise<string> {
  return sealData(data, { password: getPassword(), ttl: TTL });
}

export async function createSession(data: SessionData): Promise<void> {
  const sealed = await sealData(data, {
    password: getPassword(),
    ttl: TTL,
  });
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
  cookieStore.delete(COOKIE_NAME);
}
