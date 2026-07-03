import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildIcsContent } from "@/lib/calendar";

// Public like the event page itself: recipients of an invite/confirmation
// email already know the event details, so no session is required.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

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
    },
  });

  if (!event || event.status === "DELETED") {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(buildIcsContent(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
    },
  });
}
