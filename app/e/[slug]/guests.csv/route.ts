import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertHostOrCohost } from "@/lib/auth-guards";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let event;
  try {
    event = await assertHostOrCohost(slug, true);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "Unauthorized") return new NextResponse("Unauthorized", { status: 401 });
    return new NextResponse("Forbidden", { status: 403 });
  }

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

  // SEC-16: neutralize CSV formula injection. Spreadsheet apps evaluate any
  // cell beginning with = + - @ (or a leading tab/CR) as a formula, even when
  // the value is quoted. guestName/guestEmail are attacker-controlled (anyone
  // who can RSVP), so prefix those cells with a single quote before quoting.
  const esc = (s: string) => {
    const neutralized = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${neutralized.replace(/"/g, '""')}"`;
  };
  const header = "Name,Email,Status,Plus Ones,Approved,RSVP Date\n";
  const rows = rsvps
    .map((r) =>
      [
        esc(r.guestName),
        esc(r.guestEmail ?? ""),
        r.status,
        r.plusOneCount.toString(),
        r.approved ? "Yes" : "No",
        r.createdAt.toISOString(),
      ].join(",")
    )
    .join("\n");

  return new NextResponse(header + rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-guests.csv"`,
    },
  });
}
