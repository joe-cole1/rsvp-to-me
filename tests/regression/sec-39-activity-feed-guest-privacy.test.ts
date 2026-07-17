// SEC-39 — RSVP identities leaked through the guest-facing activity payload.
//
// Root cause (found 2026-07): SEC-32 removed a hidden guest list before the
// event object crossed the EventPage Client Component boundary, but retained
// rsvp_new/rsvp_update/rsvp_delete/guest_invite activity rows containing guest
// names and RSVP note text. ActivityFeed hid nothing, so GUESTS_ONLY anonymous
// viewers and every HOST_ONLY non-host could recover that PII from the RSC
// payload. The fix applies the existing guest-list authorization decision to
// identity-revealing activity before serialization, while retaining the prior
// non-host stripping for check-in, check-in undo, and walk-in activity.

import { describe, expect, it } from "vitest";
import {
  stripHostOnlyEventData,
  type GuestListViewer,
  type GuestListVisibility,
} from "@/lib/guestList";

const anonymous: GuestListViewer = {
  isHost: false,
  isLoggedInGuest: false,
  hasValidToken: false,
};
const loggedInGuest: GuestListViewer = { ...anonymous, isLoggedInGuest: true };
const tokenHolder: GuestListViewer = { ...anonymous, hasValidToken: true };
const organizer: GuestListViewer = { ...anonymous, isHost: true };

function eventPayload(guestListVis: GuestListVisibility) {
  return {
    guestListVis,
    host: { email: "host@example.com" },
    coHosts: [{ user: { email: "cohost@example.com" } }],
    rsvps: [{ id: "rsvp-alice", guestName: "Alice Hidden" }],
    activityEvents: [
      {
        type: "rsvp_new",
        actorName: "Alice Hidden",
        detail: "is going — note: SECRET-DIETARY-NOTE",
      },
      { type: "rsvp_update", actorName: "Bob Hidden", detail: "changed RSVP to Maybe" },
      { type: "rsvp_delete", actorName: "Carol Hidden", detail: "deleted their RSVP" },
      { type: "guest_invite", actorName: "Host", detail: "invited Dana Hidden" },
      { type: "check_in", actorName: "Host", detail: "checked in Erin Hidden" },
      { type: "check_in_undo", actorName: "Host", detail: "undid Erin Hidden check-in" },
      { type: "walk_in", actorName: "Host", detail: "added Frank Hidden as a walk-in" },
      { type: "event_date", actorName: "Host", detail: "changed the event date" },
    ],
  };
}

function serialize(visibility: GuestListVisibility, viewer: GuestListViewer) {
  return JSON.stringify(stripHostOnlyEventData(eventPayload(visibility), viewer));
}

describe("SEC-39: RSVP activity follows guest-list visibility before RSC serialization", () => {
  it("keeps RSVP identity activity public when guestListVis is ALL", () => {
    const payload = serialize("ALL", anonymous);

    expect(payload).toContain("Alice Hidden");
    expect(payload).toContain("SECRET-DIETARY-NOTE");
    expect(payload).toContain("Dana Hidden");
  });

  it("removes entire RSVP identity entries from anonymous GUESTS_ONLY payloads", () => {
    const payload = serialize("GUESTS_ONLY", anonymous);

    for (const secret of [
      "rsvp_new",
      "rsvp_update",
      "rsvp_delete",
      "guest_invite",
      "Alice Hidden",
      "Bob Hidden",
      "Carol Hidden",
      "Dana Hidden",
      "SECRET-DIETARY-NOTE",
      "changed RSVP to Maybe",
      "deleted their RSVP",
    ]) {
      expect(payload).not.toContain(secret);
    }
    expect(payload).toContain("changed the event date");
  });

  it("admits authenticated event guests and valid RSVP-token holders for GUESTS_ONLY", () => {
    for (const viewer of [loggedInGuest, tokenHolder]) {
      const payload = serialize("GUESTS_ONLY", viewer);
      expect(payload).toContain("Alice Hidden");
      expect(payload).toContain("SECRET-DIETARY-NOTE");
      expect(payload).toContain("Dana Hidden");
    }
  });

  it("removes RSVP identities from every HOST_ONLY non-host payload", () => {
    for (const viewer of [anonymous, loggedInGuest, tokenHolder]) {
      const payload = serialize("HOST_ONLY", viewer);
      expect(payload).not.toContain("rsvp_new");
      expect(payload).not.toContain("rsvp_update");
      expect(payload).not.toContain("rsvp_delete");
      expect(payload).not.toContain("guest_invite");
      expect(payload).not.toContain("Alice Hidden");
      expect(payload).not.toContain("SECRET-DIETARY-NOTE");
      expect(payload).not.toContain("Dana Hidden");
    }
  });

  it("keeps full activity for hosts, co-hosts, and moderating admins", () => {
    const payload = serialize("HOST_ONLY", organizer);

    expect(payload).toContain("Alice Hidden");
    expect(payload).toContain("SECRET-DIETARY-NOTE");
    expect(payload).toContain("Dana Hidden");
    expect(payload).toContain("Erin Hidden");
  });

  it("preserves attendance-activity stripping for all non-host viewers", () => {
    for (const visibility of ["ALL", "GUESTS_ONLY", "HOST_ONLY"] as const) {
      for (const viewer of [anonymous, loggedInGuest, tokenHolder]) {
        const payload = serialize(visibility, viewer);
        expect(payload).not.toContain("check_in");
        expect(payload).not.toContain("walk_in");
        expect(payload).not.toContain("Erin Hidden");
        expect(payload).not.toContain("Frank Hidden");
      }
    }
  });
});
