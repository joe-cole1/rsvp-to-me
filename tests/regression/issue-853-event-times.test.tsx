// #853 root cause: home cards used the server zone, dashboard cards used the browser
// zone, and the event hero omitted its zone. Dashboard projections also dropped timezone.
// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import "@/tests/helpers/english-request-locale";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@/tests/components/render";
const m = vi.hoisted(() => ({ events: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { event: { findMany: m.events } } }));
// These feed/time fixtures represent an already initialized installation.
vi.mock("@/lib/setup-state", () => ({
  getSetupState: async () => ({ required: false, configured: false }),
}));
vi.mock("@/lib/session", () => ({ getSession: async () => null }));
vi.mock("@/components/ui/UploadedImage", () => ({ default: () => null }));
import Home from "@/app/page";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { formatEventCardDate } from "@/lib/event-date";
import { formatTime } from "@/components/event/event-page/helpers";
const startAt = new Date("2030-01-02T00:09:00Z");
const event = {
  id: "event",
  slug: "party",
  title: "Party",
  startAt,
  timezone: "Asia/Seoul",
  status: "PUBLISHED" as const,
  theme: null,
  going: 0,
  maybe: 0,
  pending: 0,
  isCohost: false,
  host: { name: "Host", email: "host@example.test", avatarUrl: null },
  coHosts: [],
  commentCount: 0,
  rsvpDeadline: null,
  hostDisplayName: null,
};
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
describe("#853 event wall-clock display", () => {
  it("shows the same event-zone time and zone on home, dashboard, and the event page", async () => {
    m.events.mockResolvedValue([
      { ...event, _count: { rsvps: 0, comments: 0 }, guestListVis: "ALL", commentsEnabled: true },
    ]);
    const home = render(await Home());
    const cardTime = formatEventCardDate(startAt, event.timezone, "en-US");
    expect(cardTime).toContain("9:09");
    expect(cardTime).toMatch(/GMT\+9|KST/);
    expect(screen.getByText(cardTime)).toBeInTheDocument();
    home.unmount();
    render(
      <DashboardClient
        initialEvents={[event]}
        initialInvites={[]}
        recentActivities={[]}
        userName="Host"
        userRole="HOST"
        openRegistration
      />
    );
    expect(screen.getByText(cardTime)).toBeInTheDocument();
    const heroTime = formatTime(startAt, event.timezone, "en-US");
    expect(heroTime).toContain("9:09");
    expect(heroTime).toMatch(/GMT\+9|KST/);
  });
  it("uses the event's previous calendar day across UTC midnight", () => {
    const time = formatEventCardDate(startAt, "America/New_York", "en-US");
    expect(time).toContain("1/1");
    expect(time).toContain("7:09");
    expect(time).toMatch(/EST|GMT-5/);
  });
  it("labels each end of a range correctly across a daylight-saving transition", () => {
    const before = formatTime(new Date("2030-11-03T05:30:00Z"), "America/New_York");
    const after = formatTime(new Date("2030-11-03T06:30:00Z"), "America/New_York");
    expect(before).toContain("1:30");
    expect(after).toContain("1:30");
    expect(before).toMatch(/EDT|GMT-4/);
    expect(after).toMatch(/EST|GMT-5/);
  });
  it.each(["nl-NL", "de-DE", "es-ES"])(
    "keeps localized dates in the event zone for %s",
    (locale) => {
      expect(formatEventCardDate(startAt, event.timezone, locale)).toContain("9:09");
    }
  );
});
