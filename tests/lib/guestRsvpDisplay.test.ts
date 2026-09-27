import { describe, expect, it } from "vitest";
import {
  guestCountLabel,
  resolveGuestRsvpDisplay,
  showGuestResponseTotal,
} from "@/lib/guestRsvpDisplay";
import { SaveEventSettingsSchema } from "@/lib/schemas";

describe("guest RSVP display policy", () => {
  it("preserves the original appearance for events without saved preferences", () => {
    const display = resolveGuestRsvpDisplay();
    expect(display.NO).toEqual({ list: "EXPANDED", count: "EXACT" });
    expect(showGuestResponseTotal(display)).toBe(true);
  });

  it.each([
    [0, "0"],
    [1, "1"],
    [2, "2"],
    [3, "3+"],
    [13, "3+"],
  ])("caps a declined count of %i as %s", (count, expected) => {
    expect(guestCountLabel(count as number, { list: "COLLAPSED", count: "CAPPED" })).toBe(expected);
  });

  it("omits aggregate counts when any status hides or caps its count", () => {
    expect(showGuestResponseTotal(resolveGuestRsvpDisplay({ guestGoingCount: "HIDDEN" }))).toBe(
      false
    );
    expect(showGuestResponseTotal(resolveGuestRsvpDisplay({ guestMaybeList: "HIDDEN" }))).toBe(
      false
    );
    expect(showGuestResponseTotal(resolveGuestRsvpDisplay({ guestDeclinedCount: "CAPPED" }))).toBe(
      false
    );
    expect(
      showGuestResponseTotal(resolveGuestRsvpDisplay({ guestDeclinedCount: "CAPPED" }, true))
    ).toBe(true);
  });

  it("validates every display field and limits capped counts to declines", () => {
    expect(
      SaveEventSettingsSchema.parse({
        guestGoingList: "COLLAPSED",
        guestGoingCount: "HIDDEN",
        guestMaybeList: "HIDDEN",
        guestMaybeCount: "EXACT",
        guestDeclinedList: "EXPANDED",
        guestDeclinedCount: "CAPPED",
      })
    ).toMatchObject({ guestDeclinedCount: "CAPPED" });
    for (const settings of [
      { guestGoingCount: "CAPPED" },
      { guestMaybeCount: "CAPPED" },
      { guestDeclinedList: "PRIVATE" },
      { guestDeclinedCount: "APPROXIMATE" },
    ]) {
      expect(SaveEventSettingsSchema.safeParse(settings).success).toBe(false);
    }
  });
});
