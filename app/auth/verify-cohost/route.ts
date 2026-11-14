import { type NextRequest, NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/event-social";

// Email scanners and forwarded links cannot authenticate or accept on GET.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const path =
    token && token.length <= 128
      ? `/auth/accept-cohost?token=${encodeURIComponent(token)}`
      : "/auth/sign-in?error=invalid-token";
  const response = NextResponse.redirect(`${getAppOrigin()}${path}`);
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
