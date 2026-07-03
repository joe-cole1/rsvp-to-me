// Calendar link + ICS helpers for event emails. Attachments are not possible
// on the Cloudflare transports, so emails link to a Google Calendar template
// URL and to the /e/[slug]/calendar.ics route instead.

export type CalendarEventInput = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  startAt: Date;
  endAt?: Date | null;
  locationName?: string | null;
  locationAddress?: string | null;
  virtualUrl?: string | null;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Default event length when the host didn't set an end time. */
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

/** UTC "basic" format required by both Google Calendar URLs and ICS: 20260704T190000Z */
function toUtcBasic(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function eventLocation(ev: CalendarEventInput): string {
  const parts = [ev.locationName, ev.locationAddress].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(", ");
  return ev.virtualUrl ?? "";
}

export function buildGoogleCalendarUrl(ev: CalendarEventInput): string {
  const end = ev.endAt ?? new Date(ev.startAt.getTime() + DEFAULT_DURATION_MS);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${toUtcBasic(ev.startAt)}/${toUtcBasic(end)}`,
    details: `${ev.description ? `${ev.description}\n\n` : ""}${APP_URL}/e/${ev.slug}`,
  });
  const location = eventLocation(ev);
  if (location) params.set("location", location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsUrlForEvent(slug: string): string {
  return `${APP_URL}/e/${slug}/calendar.ics`;
}

/** Escape per RFC 5545 §3.3.11 (TEXT): backslash, semicolon, comma, newline. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets per RFC 5545 §3.1. */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return chunks.join("\r\n");
}

export function buildIcsContent(ev: CalendarEventInput): string {
  const end = ev.endAt ?? new Date(ev.startAt.getTime() + DEFAULT_DURATION_MS);
  const eventUrl = `${APP_URL}/e/${ev.slug}`;
  const location = eventLocation(ev);
  const description = `${ev.description ? `${ev.description}\n\n` : ""}${eventUrl}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RSVP to Me//Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.id}@rsvp-to-me`,
    `DTSTAMP:${toUtcBasic(new Date())}`,
    `DTSTART:${toUtcBasic(ev.startAt)}`,
    `DTEND:${toUtcBasic(end)}`,
    `SUMMARY:${escapeIcsText(ev.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    ...(location ? [`LOCATION:${escapeIcsText(location)}`] : []),
    `URL:${eventUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** "Friday, July 4, 2026" + "7:00 PM EDT" style parts in the event's timezone. */
export function formatEventDateTime(
  startAt: Date,
  endAt: Date | null | undefined,
  timezone: string | undefined
): { date: string; time: string } {
  const tz = timezone || "America/New_York";
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  }).format(startAt);
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: tz,
  });
  const start = timeFmt.format(startAt);
  const time = endAt ? `${start} – ${timeFmt.format(endAt)}` : start;
  return { date, time };
}

export function buildGoogleMapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
