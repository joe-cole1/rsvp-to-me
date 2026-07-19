// Host guest-list card disappeared when an event had no RSVPs.
//
// Bug (found 2026-07): GuestListSection applied `event.rsvps.length > 0` to
// every viewer, so hosts lost both the guest-list shortcut and RSVP-settings
// navigation until the first response existed.
//
// Fix: make the non-empty requirement apply only to non-host viewers while
// keeping the host card and its management links available from the start.

// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GuestListSection } from "@/components/event/event-page/GuestListSection";
import type { EventData } from "@/components/event/event-page/types";
import { testTheme } from "@/tests/components/helpers/theme";

const emptyEvent = {
  slug: "test-party",
  guestListVis: "ALL",
  rsvps: [],
} as unknown as EventData;

function renderGuestList(event: EventData, isHost: boolean) {
  return render(
    <GuestListSection
      event={event}
      renderAvatar={(name) => <span>{name[0]}</span>}
      t={testTheme}
      isHost={isHost}
      going={[]}
      maybe={[]}
      no={[]}
      totalGoing={0}
    />
  );
}

describe("host guest-list card visibility", () => {
  it("keeps the empty guest card and management links visible to hosts", () => {
    renderGuestList(emptyEvent, true);

    expect(screen.getByText("Guests (0)")).not.toBeNull();
    expect(screen.getByRole("link", { name: "View all →" }).getAttribute("href")).toBe(
      "/e/test-party/guests"
    );
    expect(screen.getByRole("link", { name: "RSVP settings" }).getAttribute("href")).toBe(
      "/e/test-party/settings?section=rsvp"
    );
  });

  it("continues hiding an empty guest card from non-host viewers", () => {
    renderGuestList(emptyEvent, false);

    expect(screen.queryByText("Guests (0)")).toBeNull();
    expect(screen.queryByRole("link", { name: "View all →" })).toBeNull();
    expect(screen.queryByRole("link", { name: "RSVP settings" })).toBeNull();
  });

  it("continues showing a non-empty public guest card without host settings", () => {
    const publicEvent = {
      ...emptyEvent,
      rsvps: [{ id: "rsvp-1" }],
    } as unknown as EventData;

    renderGuestList(publicEvent, false);

    expect(screen.getByText("Guests (1)")).not.toBeNull();
    expect(screen.getByRole("link", { name: "View all →" }).getAttribute("href")).toBe(
      "/e/test-party/guests"
    );
    expect(screen.queryByRole("link", { name: "RSVP settings" })).toBeNull();
  });
});
