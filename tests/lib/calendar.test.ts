import { describe, it, expect } from "vitest";
import {
  buildGoogleCalendarUrl,
  buildGoogleMapsUrl,
  buildIcsContent,
  formatEventDateTime,
  icsUrlForEvent,
} from "@/lib/calendar";

const event = {
  id: "evt_1",
  slug: "wine-night",
  title: "Wine Night; Bring a bottle, or two",
  description: "First line\nSecond line",
  startAt: new Date("2026-07-04T23:00:00Z"),
  endAt: new Date("2026-07-05T02:00:00Z"),
  locationName: "The Cole Residence",
  locationAddress: "123 Garden Lane, Brooklyn, NY",
  virtualUrl: null,
};

describe("lib/calendar.ts", () => {
  it("builds a Google Calendar template URL with UTC basic dates", () => {
    const url = new URL(buildGoogleCalendarUrl(event));
    expect(url.hostname).toBe("calendar.google.com");
    const params = url.searchParams;
    expect(params.get("action")).toBe("TEMPLATE");
    expect(params.get("dates")).toBe("20260704T230000Z/20260705T020000Z");
    expect(params.get("text")).toBe(event.title);
    expect(params.get("location")).toContain("123 Garden Lane");
    expect(params.get("details")).toContain("/e/wine-night");
  });

  it("defaults the end time to start + 2h when endAt is missing", () => {
    const url = new URL(buildGoogleCalendarUrl({ ...event, endAt: null }));
    expect(url.searchParams.get("dates")).toBe("20260704T230000Z/20260705T010000Z");
  });

  it("builds ICS with RFC 5545 escaping, UID, and CRLF line endings", () => {
    const ics = buildIcsContent(event);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("UID:evt_1@rsvp-to-me");
    expect(ics).toContain("DTSTART:20260704T230000Z");
    expect(ics).toContain("DTEND:20260705T020000Z");
    expect(ics).toContain("SUMMARY:Wine Night\\; Bring a bottle\\, or two");
    expect(ics).toContain("DESCRIPTION:First line\\nSecond line");
    expect(ics).toContain("END:VCALENDAR");
    // every line ends with CRLF and none exceeds the 75-octet fold limit
    for (const line of ics.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
      expect(line).not.toContain("\n");
    }
  });

  it("formats date/time in the event's timezone", () => {
    const { date, time } = formatEventDateTime(event.startAt, event.endAt, "America/New_York");
    expect(date).toBe("Saturday, July 4, 2026");
    expect(time).toContain("7:00 PM");
    expect(time).toContain("10:00 PM");
    expect(time).toContain("EDT");
  });

  it("builds encoded maps and ics URLs", () => {
    expect(buildGoogleMapsUrl("a b&c")).toBe(
      "https://www.google.com/maps/search/?api=1&query=a%20b%26c"
    );
    expect(icsUrlForEvent("wine-night")).toBe("http://localhost:3000/e/wine-night/calendar.ics");
  });
});
