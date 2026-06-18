import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sealSession, COOKIE_NAME, SESSION_TTL } from "@/lib/session";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${APP_URL()}/profile?error=invalid-token`);
  }

  const record = await db.magicToken.findUnique({ where: { token } });
  if (!record || record.used || record.expiresAt < new Date() || record.type === "LOGIN") {
    return NextResponse.redirect(`${APP_URL()}/profile?error=invalid-token`);
  }

  await db.magicToken.update({ where: { id: record.id }, data: { used: true } });

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    return NextResponse.redirect(`${APP_URL()}/profile?error=invalid-token`);
  }

  const isEmail = record.type === "EMAIL_CHANGE";
  const newValue = record.metadata;
  if (!newValue) {
    return NextResponse.redirect(`${APP_URL()}/profile?error=invalid-token`);
  }

  if (isEmail) {
    const existing = await db.user.findFirst({ where: { email: newValue, NOT: { id: user.id } } });
    if (existing) {
      return NextResponse.redirect(`${APP_URL()}/profile?error=email-taken`);
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
      return NextResponse.redirect(`${APP_URL()}/profile?error=phone-taken`);
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

  const sealed = await sealSession({
    userId: user.id,
    email: newValue,
    role: user.role as "HOST" | "ADMIN" | "GUEST",
  });

  const response = NextResponse.redirect(`${APP_URL()}/profile?verified=1`);
  response.cookies.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL,
    path: "/",
  });

  return response;
}
