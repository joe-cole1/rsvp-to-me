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

  const [submissions, rsvps] = await Promise.all([
    db.questionnaireSubmission.findMany({
      where: { eventId: event.id },
      select: {
        respondentName: true,
        updatedAt: true,
        answers: { select: { rsvpFieldId: true, value: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.rSVP.findMany({
      where: { eventId: event.id, responded: true, answers: { some: {} } },
      select: {
        guestName: true,
        updatedAt: true,
        answers: { select: { rsvpFieldId: true, value: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // SEC-16: neutralize CSV formula injection on all respondent-controlled cells.
  const esc = (s: string) => {
    const neutralized = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${neutralized.replace(/"/g, '""')}"`;
  };
  const formatLocal = (date: Date) => {
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
    "Source",
    `Submitted (${exportConfig.timezone})`,
    ...questionHeaders,
    "Submitted (UTC)",
  ];
  const header = `${headers.map(esc).join(",")}\n`;

  const combined = [
    ...submissions.map((sub) => ({
      name: sub.respondentName,
      source: "Event page",
      submittedAt: sub.updatedAt,
      answers: sub.answers,
    })),
    ...rsvps.map((rsvp) => ({
      name: rsvp.guestName,
      source: "RSVP",
      submittedAt: rsvp.updatedAt,
      answers: rsvp.answers,
    })),
  ];

  const rows = combined
    .map((entry) => {
      const answers = new Map(entry.answers.map((answer) => [answer.rsvpFieldId, answer.value]));
      return [
        esc(entry.name),
        esc(entry.source),
        esc(formatLocal(entry.submittedAt)),
        ...exportConfig.rsvpFields.map((field) => esc(answers.get(field.id) ?? "")),
        esc(entry.submittedAt.toISOString()),
      ].join(",");
    })
    .join("\n");

  return new NextResponse(header + rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-questionnaire.csv"`,
    },
  });
}
