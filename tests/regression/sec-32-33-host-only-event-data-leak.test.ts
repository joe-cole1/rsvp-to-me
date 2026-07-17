// SEC-32 / SEC-33 — Host-only event data leaked into the guest-facing surfaces.
//
// Bugs (found 2026-07, OWASP audit [cd6748]):
//   SEC-32: app/e/[slug]/page.tsx passed the full Prisma event object straight
//     into the <EventPage> Client Component. Everything in the query therefore
//     shipped in the RSC payload to ANY viewer who could load the page — even
//     data the UI only hid at render time: host/co-host email addresses, and
//     the full approved guest list when guestListVis was GUESTS_ONLY/HOST_ONLY
//     (GuestListSection hid it with a `guestListVis === "ALL" || isHost` guard,
//     but the rows were still serialized).
//   SEC-33: app/e/[slug]/guests/page.tsx only redirected on HOST_ONLY. A
//     GUESTS_ONLY event's full guest list was reachable by any anonymous
//     visitor who opened /e/<slug>/guests directly.
//
// Fix: lib/guestList.stripHostOnlyEventData nulls host/co-host email and empties
// the guest list for non-hosts when the list isn't public, and
// lib/guestList.canViewGuestListPage enforces the guest-list-visibility setting
// for the dedicated guests page. Both tests fail against the pre-fix code
// (neither helper existed; page.tsx shipped every field and gated only
// HOST_ONLY).

import { describe, it, expect } from "vitest";
import {
  stripHostOnlyEventData,
  canViewGuestListPage,
  type GuestListViewer,
} from "@/lib/guestList";

function sampleEvent(guestListVis: string) {
  return {
    id: "event-1",
    title: "Party",
    guestListVis,
    host: { name: "Hank Host", email: "host@example.com" },
    coHosts: [{ id: "ch-1", displayName: null, user: { name: null, email: "cohost@example.com" } }],
    rsvps: [
      { id: "rsvp-1", guestName: "Alice" },
      { id: "rsvp-2", guestName: "Bob" },
    ],
    activityEvents: [
      { type: "check_in", detail: "checked in Alice" },
      { type: "check_in_undo", detail: "undid check-in for Alice" },
      { type: "walk_in", detail: "added and checked in Bob" },
      { type: "event_date", detail: "changed the date" },
    ],
  };
}

const anonymousViewer: GuestListViewer = {
  isHost: false,
  isLoggedInGuest: false,
  hasValidToken: false,
};

describe("SEC-32: stripHostOnlyEventData scrubs the non-host RSC payload", () => {
  it("nulls host and co-host emails for a non-host viewer", () => {
    const out = stripHostOnlyEventData(sampleEvent("ALL"), anonymousViewer);
    expect(out.host.email).toBeNull();
    expect(out.coHosts[0].user.email).toBeNull();
    // Display names survive so the UI still renders.
    expect(out.host.name).toBe("Hank Host");
  });

  it("keeps the guest list for a non-host when guestListVis is ALL", () => {
    const out = stripHostOnlyEventData(sampleEvent("ALL"), anonymousViewer);
    expect(out.rsvps).toHaveLength(2);
  });

  it("empties the guest list for a non-host when the list is not public", () => {
    for (const vis of ["GUESTS_ONLY", "HOST_ONLY"]) {
      const out = stripHostOnlyEventData(sampleEvent(vis), anonymousViewer);
      expect(out.rsvps).toEqual([]);
    }
  });

  it("leaves everything intact for a host", () => {
    const out = stripHostOnlyEventData(sampleEvent("HOST_ONLY"), {
      ...anonymousViewer,
      isHost: true,
    });
    expect(out.host.email).toBe("host@example.com");
    expect(out.coHosts[0].user.email).toBe("cohost@example.com");
    expect(out.rsvps).toHaveLength(2);
    expect(out.activityEvents).toHaveLength(4);
  });

  it("strips host-only attendance activity for non-host viewers", () => {
    const out = stripHostOnlyEventData(sampleEvent("ALL"), anonymousViewer);
    expect(out.activityEvents).toEqual([{ type: "event_date", detail: "changed the date" }]);
  });
});

describe("SEC-33: canViewGuestListPage enforces guest-list visibility", () => {
  const anon: GuestListViewer = { isHost: false, isLoggedInGuest: false, hasValidToken: false };
  const guest: GuestListViewer = { isHost: false, isLoggedInGuest: true, hasValidToken: false };
  const tokenHolder: GuestListViewer = {
    isHost: false,
    isLoggedInGuest: false,
    hasValidToken: true,
  };
  const host: GuestListViewer = { isHost: true, isLoggedInGuest: false, hasValidToken: false };

  it("ALL: anyone who cleared the access gate may view", () => {
    expect(canViewGuestListPage("ALL", anon)).toBe(true);
  });

  it("HOST_ONLY: only hosts", () => {
    expect(canViewGuestListPage("HOST_ONLY", anon)).toBe(false);
    expect(canViewGuestListPage("HOST_ONLY", guest)).toBe(false);
    expect(canViewGuestListPage("HOST_ONLY", host)).toBe(true);
  });

  it("GUESTS_ONLY: hosts and the event's own guests, never an anonymous visitor", () => {
    expect(canViewGuestListPage("GUESTS_ONLY", anon)).toBe(false); // the bug
    expect(canViewGuestListPage("GUESTS_ONLY", guest)).toBe(true);
    expect(canViewGuestListPage("GUESTS_ONLY", tokenHolder)).toBe(true);
    expect(canViewGuestListPage("GUESTS_ONLY", host)).toBe(true);
  });
});
