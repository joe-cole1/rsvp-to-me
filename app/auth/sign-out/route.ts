import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { getAppOrigin } from "@/lib/event-social";
import { destroySession } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(getAppOrigin()).origin) {
    return new NextResponse(null, { status: 403 });
  }
  await destroySession();
  redirect("/auth/sign-in");
}
