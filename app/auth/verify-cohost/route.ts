import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sealSession, COOKIE_NAME, SESSION_TTL } from "@/lib/session";
import { linkRsvpsToUser } from "@/lib/auth";
import { randomUUID } from "crypto";
import { isRedisEnabled, redisSet } from "@/lib/redis";
import { hashToken } from "@/lib/hash";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
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
  const record = await db.coHostInvitation.findUnique({
    where: { token: hashedToken },
    include: { event: { select: { slug: true, title: true } } },
  });

  if (!record || record.expiresAt < new Date()) {
    return redirectWithNoReferrer(`${origin}/auth/sign-in?error=invalid-token`);
  }

  const email = record.email.toLowerCase().trim();

  // Find or create user
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        role: "HOST", // upgrade to host so they can view settings/dashboard
      },
    });
  } else if (user.role === "GUEST") {
    // Upgrade guest to host
    user = await db.user.update({
      where: { id: user.id },
      data: { role: "HOST" },
    });
  }

  // Create co-host record
  try {
    await db.eventCoHost.create({
      data: {
        eventId: record.eventId,
        userId: user.id,
      },
    });
  } catch {
    // If they are already a co-host, we can ignore the error
  }

  // Delete the invitation
  await db.coHostInvitation.delete({ where: { id: record.id } });

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
    email: user.email ?? "",
    role: user.role as "HOST" | "ADMIN" | "GUEST",
    sessionId,
  });

  // Redirect to event settings Hosts section
  const destination = `${origin}/e/${record.event.slug}/settings?activeSection=hosts`;

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
