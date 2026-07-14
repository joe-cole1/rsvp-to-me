// The guest-list All filter counted invited guests but did not render them.
//
// Bug (found 2026-07): invited cards were gated on the INVITED filter even
// though the All chip's count included them. An event with only unresponded
// invitees therefore showed "No one here yet" under All.
//
// Fix: render host-visible invited cards under both All and Invited, and include
// those cards when deciding whether the All view is empty.

// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { testTheme } from "@/tests/components/helpers/theme";

vi.mock("@/app/actions/event", () => ({
  addWalkIn: vi.fn(),
  approveRsvp: vi.fn(),
  checkInRsvp: vi.fn(),
  declineRsvp: vi.fn(),
  deleteRsvpAsHost: vi.fn(),
  inviteGuest: vi.fn(),
  undoCheckIn: vi.fn(),
}));
vi.mock("next/image", () => ({ default: () => null }));

import { GuestListFilter } from "@/components/event/GuestListFilter";

const invited = {
  id: "invited-1",
  sentTo: "ivy@example.com",
  channel: "EMAIL" as const,
  sentAt: "2026-07-14T18:00:00.000Z",
  guestName: "Ivy Invitee",
  editToken: "invite-token",
};

const going = {
  id: "going-1",
  guestName: "Ada Attendee",
  guestEmail: "ada@example.com",
  guestPhone: null,
  status: "GOING" as const,
  plusOneCount: 0,
  note: null,
  createdAt: "2026-07-14T17:00:00.000Z",
  answers: [],
  plusOneGuests: [],
  editToken: "rsvp-token",
  user: null,
  checkIn: null,
};

function renderList(goingGuests = [going]) {
  return render(
    <GuestListFilter
      going={goingGuests}
      maybe={[]}
      no={[]}
      invited={[invited]}
      isHost
      eventId="event-1"
      slug="party"
      timezone="America/New_York"
      channelConfig={{ email: true, sms: true }}
      t={testTheme}
    />
  );
}

describe("guest-list All filter", () => {
  it("shows responded and invited guests together", () => {
    renderList();

    expect(screen.getByText("Ada Attendee")).not.toBeNull();
    expect(screen.getByText("Ivy Invitee")).not.toBeNull();
    expect(screen.getByText("ivy@example.com")).not.toBeNull();
  });

  it("does not show an empty state when the event has only invited guests", () => {
    renderList([]);

    expect(screen.getByText("Ivy Invitee")).not.toBeNull();
    expect(screen.queryByText("No one here yet.")).toBeNull();
  });
});
