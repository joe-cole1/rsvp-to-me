import { describe, expect, it } from "vitest";
import {
  GUEST_DISPLAY_ROWS,
  guestCountLabel,
  guestRsvpDisplayFields,
  isGuestRowShown,
  resolveGuestRsvpDisplay,
  showGuestResponseTotal,
} from "@/lib/guestRsvpDisplay";
import { invitedGuestsForViewer, stripHostOnlyEventData } from "@/lib/guestList";
import { SaveEventSettingsSchema } from "@/lib/schemas";

describe("guest RSVP display policy", () => {
  it("preserves the original appearance for events without saved preferences", () => {
    const display = resolveGuestRsvpDisplay();
    expect(display.NO).toEqual({ list: "EXPANDED", count: "EXACT" });
    expect(showGuestResponseTotal(display)).toBe(true);
  });

  it("keeps Invited hidden from guests unless the host turns it on", () => {
    expect(guestRsvpDisplayFields()).toMatchObject({
      guestInvitedList: "HIDDEN",
      guestInvitedCount: "HIDDEN",
    });
    expect(resolveGuestRsvpDisplay().INVITED).toEqual({ list: "HIDDEN", count: "HIDDEN" });
    expect(isGuestRowShown(resolveGuestRsvpDisplay().INVITED)).toBe(false);
  });

  it("shows hosts the Invited row in full only when guests can see it", () => {
    expect(resolveGuestRsvpDisplay({}, true).INVITED).toEqual({ list: "HIDDEN", count: "HIDDEN" });
    expect(resolveGuestRsvpDisplay({ guestInvitedCount: "CAPPED" }, true).INVITED).toEqual({
      list: "EXPANDED",
      count: "EXACT",
    });
  });

  it("lists every configurable row, ending with Invited", () => {
    expect(GUEST_DISPLAY_ROWS.map((row) => row.status)).toEqual([
      "GOING",
      "MAYBE",
      "NO",
      "INVITED",
    ]);
  });

  it.each([
    [0, "0"],
    [1, "1"],
    [2, "2"],
    [3, "3+"],
    [13, "3+"],
  ])("caps a count of %i as %s", (count, expected) => {
    expect(guestCountLabel(count as number, { list: "COLLAPSED", count: "CAPPED" })).toBe(expected);
  });

  it("shows a count even when the row's names are hidden", () => {
    expect(guestCountLabel(5, { list: "HIDDEN", count: "EXACT" })).toBe("5");
    expect(guestCountLabel(5, { list: "HIDDEN", count: "CAPPED" })).toBe("3+");
    expect(guestCountLabel(5, { list: "EXPANDED", count: "HIDDEN" })).toBeNull();
    expect(isGuestRowShown({ list: "HIDDEN", count: "EXACT" })).toBe(true);
  });

  it("omits aggregate counts when any reply count is hidden or capped", () => {
    expect(showGuestResponseTotal(resolveGuestRsvpDisplay({ guestGoingCount: "HIDDEN" }))).toBe(
      false
    );
    expect(showGuestResponseTotal(resolveGuestRsvpDisplay({ guestMaybeCount: "CAPPED" }))).toBe(
      false
    );
    expect(showGuestResponseTotal(resolveGuestRsvpDisplay({ guestDeclinedCount: "CAPPED" }))).toBe(
      false
    );
    expect(
      showGuestResponseTotal(resolveGuestRsvpDisplay({ guestDeclinedCount: "CAPPED" }, true))
    ).toBe(true);
  });

  it("keeps the total when only names are hidden, and ignores Invited", () => {
    expect(showGuestResponseTotal(resolveGuestRsvpDisplay({ guestMaybeList: "HIDDEN" }))).toBe(
      true
    );
    expect(
      showGuestResponseTotal(
        resolveGuestRsvpDisplay({ guestInvitedList: "EXPANDED", guestInvitedCount: "CAPPED" })
      )
    ).toBe(true);
  });

  it("validates every display field, including Invited, and allows 3+ on every row", () => {
    expect(
      SaveEventSettingsSchema.parse({
        guestGoingList: "COLLAPSED",
        guestGoingCount: "CAPPED",
        guestMaybeList: "HIDDEN",
        guestMaybeCount: "CAPPED",
        guestDeclinedList: "EXPANDED",
        guestDeclinedCount: "CAPPED",
        guestInvitedList: "COLLAPSED",
        guestInvitedCount: "CAPPED",
      })
    ).toMatchObject({
      guestGoingCount: "CAPPED",
      guestMaybeCount: "CAPPED",
      guestInvitedList: "COLLAPSED",
      guestInvitedCount: "CAPPED",
    });
    for (const settings of [
      { guestDeclinedList: "PRIVATE" },
      { guestDeclinedCount: "APPROXIMATE" },
      { guestInvitedList: "SHOWN" },
      { guestInvitedCount: "ALL" },
    ]) {
      expect(SaveEventSettingsSchema.safeParse(settings).success).toBe(false);
    }
  });
});

describe("invited guests sent to a viewer", () => {
  const rows = [
    { id: "i1", guestName: "Kai" },
    { id: "i2", guestName: "Lu" },
    { id: "i3", guestName: "Mo" },
    { id: "i4", guestName: "Ned" },
  ];

  it("sends nothing while the Invited row is hidden", () => {
    expect(invitedGuestsForViewer({ list: "HIDDEN", count: "HIDDEN" }, rows)).toEqual({
      invitedGuests: [],
      invitedCount: 0,
    });
  });

  it("sends a count without names when only the count shows", () => {
    expect(invitedGuestsForViewer({ list: "HIDDEN", count: "EXACT" }, rows)).toEqual({
      invitedGuests: [],
      invitedCount: 4,
    });
  });

  it("never sends more than the cap when the count is 3+", () => {
    expect(invitedGuestsForViewer({ list: "HIDDEN", count: "CAPPED" }, rows).invitedCount).toBe(3);
  });

  it("drops invited names and count when the guest list is not public", () => {
    const event = {
      guestListVis: "GUESTS_ONLY",
      host: { email: "host@example.test" },
      coHosts: [],
      rsvps: [],
      invitedGuests: rows,
      invitedCount: 4,
    };
    const viewer = { isHost: false, isLoggedInGuest: true, hasValidToken: false };
    expect(stripHostOnlyEventData(event, viewer)).toMatchObject({
      invitedGuests: [],
      invitedCount: 0,
    });
    expect(stripHostOnlyEventData({ ...event, guestListVis: "ALL" }, viewer)).toMatchObject({
      invitedGuests: rows,
      invitedCount: 4,
    });
  });

  it("sends only ids and names when names show", () => {
    const withContact = rows.map((row) => ({ ...row, guestEmail: "x@example.test" }));
    const { invitedGuests } = invitedGuestsForViewer(
      { list: "COLLAPSED", count: "HIDDEN" },
      withContact
    );
    expect(invitedGuests).toEqual(rows);
  });
});
