import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sealSession, COOKIE_NAME, SESSION_TTL } from "@/lib/session";
import { linkRsvpsToUser, isSafeRedirect } from "@/lib/auth";
import { randomUUID } from "crypto";
import { isRedisEnabled, redisSet } from "@/lib/redis";
import { hashToken } from "@/lib/hash";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const rawRedirect = request.nextUrl.searchParams.get("redirect");
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;

  const redirectWithNoReferrer = (url: string) => {
    const res = NextResponse.redirect(url);
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  };

  if (!token) {
    return redirectWithNoReferrer(`${origin}/auth/sign-in`);
  }

  if (token.length > 128) {
    return redirectWithNoReferrer(`${origin}/auth/sign-in?error=invalid-token`);
  }

  const hashedToken = hashToken(token);
  const record = await db.magicToken.findUnique({ where: { token: hashedToken } });
  if (!record || record.used || record.expiresAt < new Date() || record.type !== "LOGIN") {
    return redirectWithNoReferrer(`${origin}/auth/sign-in?error=invalid-token`);
  }

  await db.magicToken.update({ where: { id: record.id }, data: { used: true } });

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    return redirectWithNoReferrer(`${origin}/auth/sign-in?error=invalid-token`);
  }

  // Link any matching RSVPs dynamically on sign-in
  await linkRsvpsToUser(user.id);

  // Generate session ID and expiration
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000);

  // Store the session in the database
  await db.session.create({
    data: {
      id: sessionId,
      token: sessionId,
      userId: user.id,
      expiresAt,
    },
  });

  // Store in Redis cache if active
  if (isRedisEnabled()) {
    const cacheKey = `session:${sessionId}`;
    const cacheValue = {
      id: sessionId,
      userId: user.id,
      expiresAt: expiresAt.toISOString(),
      userRole: user.role,
    };
    await redisSet(cacheKey, JSON.stringify(cacheValue), SESSION_TTL);
  }

  const sealed = await sealSession({
    userId: user.id,
    email: user.email ?? user.phone ?? "",
    role: user.role as "HOST" | "ADMIN" | "GUEST",
    sessionId, // Crucial: Include sessionId so getSession() validates it successfully
  });

  // Validate redirect at the point of use — defence in depth against encoded payloads
  // that bypassed the check in createMagicLink (e.g. %2F-encoded slashes).
  const destination =
    rawRedirect && isSafeRedirect(rawRedirect) ? `${origin}${rawRedirect}` : `${origin}/dashboard`;

  const response = redirectWithNoReferrer(destination);
  response.cookies.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.DISABLE_HSTS !== "true",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });

  return response;
}
