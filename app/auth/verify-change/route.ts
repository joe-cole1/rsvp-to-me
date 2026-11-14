import { getAppOrigin } from "@/lib/event-social";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sealSession, COOKIE_NAME, SESSION_TTL } from "@/lib/session";
import { linkRsvpsToUser } from "@/lib/auth";
import { randomUUID } from "crypto";
import { isRedisEnabled, redisSet } from "@/lib/redis";
import { retireChangedAccountConnection } from "@/lib/notifications/lifecycle";
import { hashToken } from "@/lib/hash";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const origin = getAppOrigin();

  const redirectWithNoReferrer = (url: string) => {
    const res = NextResponse.redirect(url);
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  };

  if (!token) {
    return redirectWithNoReferrer(`${origin}/profile?error=invalid-token`);
  }

  if (token.length > 128) {
    return redirectWithNoReferrer(`${origin}/profile?error=invalid-token`);
  }

  const hashedToken = hashToken(token);
  const record = await db.magicToken.findUnique({ where: { token: hashedToken } });
  if (
    !record ||
    record.used ||
    record.expiresAt <= new Date() ||
    !["EMAIL_CHANGE", "PHONE_CHANGE"].includes(record.type)
  ) {
    return redirectWithNoReferrer(`${origin}/profile?error=invalid-token`);
  }

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    return redirectWithNoReferrer(`${origin}/profile?error=invalid-token`);
  }

  const isEmail = record.type === "EMAIL_CHANGE";
  const newValue = record.metadata;
  if (!newValue) {
    return redirectWithNoReferrer(`${origin}/profile?error=invalid-token`);
  }

  // Check for conflicts before consuming the token so it isn't burned on a recoverable error
  if (isEmail) {
    const existing = await db.user.findFirst({ where: { email: newValue, NOT: { id: user.id } } });
    if (existing) {
      return redirectWithNoReferrer(`${origin}/profile?error=email-taken`);
    }
  } else {
    const existing = await db.user.findFirst({ where: { phone: newValue, NOT: { id: user.id } } });
    if (existing) {
      return redirectWithNoReferrer(`${origin}/profile?error=phone-taken`);
    }
  }

  const consumed = await db.magicToken.updateMany({
    where: {
      id: record.id,
      used: false,
      expiresAt: { gt: new Date() },
      type: { in: ["EMAIL_CHANGE", "PHONE_CHANGE"] },
    },
    data: { used: true },
  });
  if (consumed.count !== 1) return redirectWithNoReferrer(`${origin}/profile?error=invalid-token`);

  if (isEmail) {
    await db.user.update({
      where: { id: user.id },
      data: { email: newValue },
    });
  } else {
    await db.user.update({
      where: { id: user.id },
      data: { phone: newValue },
    });
  }

  await retireChangedAccountConnection(
    user.id,
    isEmail ? "email" : "sms",
    isEmail ? user.email : user.phone
  );

  // Link any matching RSVPs dynamically on profile change verification
  await linkRsvpsToUser(user.id);

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000);

  await db.session.create({
    data: {
      id: sessionId,
      token: sessionId,
      userId: user.id,
      expiresAt,
    },
  });

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
    email: newValue,
    role: user.role as "HOST" | "ADMIN" | "GUEST",
    sessionId,
  });

  const response = redirectWithNoReferrer(`${origin}/profile?verified=1`);
  response.cookies.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.DISABLE_HSTS !== "true",
    sameSite: "lax",
    maxAge: SESSION_TTL,
    path: "/",
  });

  return response;
}
