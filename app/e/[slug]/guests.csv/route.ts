import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const event = await db.event.findUnique({
    where: { slug },
    select: { id: true, hostId: true },
  });

  if (!event) return new NextResponse("Not found", { status: 404 });
  if (event.hostId !== session.userId) return new NextResponse("Forbidden", { status: 403 });

  const rsvps = await db.rSVP.findMany({
    where: { eventId: event.id },
    select: {
      guestName: true,
      guestEmail: true,
      status: true,
      plusOneCount: true,
      approved: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = "Name,Email,Status,Plus Ones,Approved,RSVP Date\n";
  const rows = rsvps.map((r) =>
    [
      esc(r.guestName),
      esc(r.guestEmail ?? ""),
      r.status,
      r.plusOneCount.toString(),
      r.approved ? "Yes" : "No",
      r.createdAt.toISOString(),
    ].join(",")
  ).join("\n");

  return new NextResponse(header + rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-guests.csv"`,
    },
  });
}
