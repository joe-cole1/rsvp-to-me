import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sealSession, COOKIE_NAME, SESSION_TTL } from "@/lib/session";
import { linkRsvpsToUser } from "@/lib/auth";
import { randomUUID } from "crypto";
import { isRedisEnabled, redisSet } from "@/lib/redis";
import { hashToken } from "@/lib/hash";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  const redirectWithNoReferrer = (url: string) => {
    const res = NextResponse.redirect(url);
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  };

  if (!token) {
    return redirectWithNoReferrer(`${APP_URL()}/profile?error=invalid-token`);
  }

  if (token.length > 128) {
    return redirectWithNoReferrer(`${APP_URL()}/profile?error=invalid-token`);
  }

  const hashedToken = hashToken(token);
  const record = await db.magicToken.findUnique({ where: { token: hashedToken } });
  if (!record || record.used || record.expiresAt < new Date() || record.type === "LOGIN") {
    return redirectWithNoReferrer(`${APP_URL()}/profile?error=invalid-token`);
  }

  await db.magicToken.update({ where: { id: record.id }, data: { used: true } });

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    return redirectWithNoReferrer(`${APP_URL()}/profile?error=invalid-token`);
  }

  const isEmail = record.type === "EMAIL_CHANGE";
  const newValue = record.metadata;
  if (!newValue) {
    return redirectWithNoReferrer(`${APP_URL()}/profile?error=invalid-token`);
  }

  if (isEmail) {
    const existing = await db.user.findFirst({ where: { email: newValue, NOT: { id: user.id } } });
    if (existing) {
      return redirectWithNoReferrer(`${APP_URL()}/profile?error=email-taken`);
    }
    await db.user.update({
      where: { id: user.id },
      data: { email: newValue },
    });
    await db.rSVP.updateMany({
      where: { userId: user.id },
      data: { guestEmail: newValue },
    });
  } else {
    const existing = await db.user.findFirst({ where: { phone: newValue, NOT: { id: user.id } } });
    if (existing) {
      return redirectWithNoReferrer(`${APP_URL()}/profile?error=phone-taken`);
    }
    await db.user.update({
      where: { id: user.id },
      data: { phone: newValue },
    });
    await db.rSVP.updateMany({
      where: { userId: user.id },
      data: { guestPhone: newValue },
    });
  }

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

  const response = redirectWithNoReferrer(`${APP_URL()}/profile?verified=1`);
  response.cookies.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL,
    path: "/",
  });

  return response;
}
