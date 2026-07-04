import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildIcsContent } from "@/lib/calendar";
import { resolveEventAccess } from "@/lib/eventAccess";

// The ICS export discloses the full event details (description, address,
// virtual meeting URL, exact timings), so it must enforce the same
// visibility/password gate as the event page. Recipients reach it via the
// signed unlock cookie, a valid RSVP token, or an authenticated host session —
// never as an anonymous scrape of a PRIVATE or password-protected event.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? undefined;

  const event = await db.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      startAt: true,
      endAt: true,
      locationName: true,
      locationAddress: true,
      virtualUrl: true,
      status: true,
      visibility: true,
      passwordHash: true,
      hostId: true,
      coHosts: { select: { userId: true } },
    },
  });

  if (!event || event.status === "DELETED") {
    return new NextResponse("Not found", { status: 404 });
  }

  const { decision } = await resolveEventAccess(event, slug, { token });
  if (decision !== "granted") {
    // Fail closed: don't disclose details (or existence) to unauthorized callers.
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(buildIcsContent(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
    },
  });
}
