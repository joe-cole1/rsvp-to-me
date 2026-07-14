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

  const exportConfig = await db.event.findUnique({
    where: { id: event.id },
    select: {
      timezone: true,
      rsvpFields: { select: { id: true, label: true }, orderBy: { order: "asc" } },
    },
  });
  if (!exportConfig) return new NextResponse("Not Found", { status: 404 });

  const rsvps = await db.rSVP.findMany({
    where: { eventId: event.id },
    select: {
      guestName: true,
      guestEmail: true,
      guestPhone: true,
      status: true,
      plusOneCount: true,
      approved: true,
      createdAt: true,
      answers: { select: { rsvpFieldId: true, value: true } },
      checkIn: { select: { checkedInAt: true } },
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
  const formatLocal = (date: Date | null) => {
    if (!date) return "";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: exportConfig.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
  };

  const labelCounts = new Map<string, number>();
  const questionHeaders = exportConfig.rsvpFields.map((field) => {
    const count = (labelCounts.get(field.label) ?? 0) + 1;
    labelCounts.set(field.label, count);
    return count === 1 ? field.label : `${field.label} (${count})`;
  });
  const headers = [
    "Name",
    "Email",
    "Phone",
    "Status",
    "Plus Ones",
    "Approved",
    `RSVP Date (${exportConfig.timezone})`,
    `Check-In Time (${exportConfig.timezone})`,
    ...questionHeaders,
    "RSVP Date (UTC)",
    "Check-In Time (UTC)",
  ];
  const header = `${headers.map(esc).join(",")}\n`;
  const rows = rsvps
    .map((r) => {
      const answers = new Map(r.answers.map((answer) => [answer.rsvpFieldId, answer.value]));
      return [
        esc(r.guestName),
        esc(r.guestEmail ?? ""),
        esc(r.guestPhone ?? ""),
        esc(r.status),
        esc(r.plusOneCount.toString()),
        esc(r.approved ? "Yes" : "No"),
        esc(formatLocal(r.createdAt)),
        esc(formatLocal(r.checkIn?.checkedInAt ?? null)),
        ...exportConfig.rsvpFields.map((field) => esc(answers.get(field.id) ?? "")),
        esc(r.createdAt.toISOString()),
        esc(r.checkIn?.checkedInAt.toISOString() ?? ""),
      ].join(",");
    })
    .join("\n");

  return new NextResponse(header + rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-guests.csv"`,
    },
  });
}
