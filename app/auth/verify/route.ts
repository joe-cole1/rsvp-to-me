import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sealSession, COOKIE_NAME, SESSION_TTL } from "@/lib/session";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${APP_URL()}/auth/sign-in`);
  }

  const record = await db.magicToken.findUnique({ where: { token } });
  if (!record || record.used || record.expiresAt < new Date()) {
    return NextResponse.redirect(`${APP_URL()}/auth/sign-in?error=invalid-token`);
  }

  await db.magicToken.update({ where: { id: record.id }, data: { used: true } });

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    return NextResponse.redirect(`${APP_URL()}/auth/sign-in?error=invalid-token`);
  }

  const sealed = await sealSession({ userId: user.id, email: user.email ?? user.phone ?? "" });

  const response = NextResponse.redirect(`${APP_URL()}/dashboard`);
  response.cookies.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL,
    path: "/",
  });

  return response;
}
