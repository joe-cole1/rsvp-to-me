import { type NextRequest, NextResponse } from "next/server";
import { verifyMagicToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const ok = await verifyMagicToken(token);

  if (!ok) {
    return NextResponse.redirect(new URL("/auth/sign-in?error=invalid-token", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
