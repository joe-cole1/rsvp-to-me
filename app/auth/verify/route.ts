import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sealSession, COOKIE_NAME, SESSION_TTL } from "@/lib/session";
import { linkRsvpsToUser } from "@/lib/auth";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  const redirectWithNoReferrer = (url: string) => {
    const res = NextResponse.redirect(url);
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  };

  if (!token) {
    return redirectWithNoReferrer(`${APP_URL()}/auth/sign-in`);
  }

  const record = await db.magicToken.findUnique({ where: { token } });
  if (!record || record.used || record.expiresAt < new Date()) {
    return redirectWithNoReferrer(`${APP_URL()}/auth/sign-in?error=invalid-token`);
  }

  await db.magicToken.update({ where: { id: record.id }, data: { used: true } });

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    return redirectWithNoReferrer(`${APP_URL()}/auth/sign-in?error=invalid-token`);
  }

  // Link any matching RSVPs dynamically on sign-in
  await linkRsvpsToUser(user.id);

  const sealed = await sealSession({
    userId: user.id,
    email: user.email ?? user.phone ?? "",
    role: user.role as "HOST" | "ADMIN" | "GUEST",
  });

  const response = redirectWithNoReferrer(`${APP_URL()}/dashboard`);
  response.cookies.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL,
    path: "/",
  });

  return response;
}
