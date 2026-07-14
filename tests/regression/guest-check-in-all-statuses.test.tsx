// Guests who had not replied or had answered "Can't make it" could not be checked in.
//
// Bug (found 2026-07): both the server action and guest-list controls restricted
// check-in to approved Going/Maybe RSVPs. The walk-in form also stopped after
// finding an existing RSVP, despite promising to add and check in the guest.
//
// Fix: expose attendance controls for every linked RSVP status and let the host
// resend unanswered invitations from the same guest card.

// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { testTheme } from "@/tests/components/helpers/theme";

const mocks = vi.hoisted(() => ({
  checkInRsvp: vi.fn(),
  inviteGuest: vi.fn(),
}));

vi.mock("@/app/actions/event", () => ({
  addWalkIn: vi.fn(),
  approveRsvp: vi.fn(),
  checkInRsvp: mocks.checkInRsvp,
  declineRsvp: vi.fn(),
  deleteRsvpAsHost: vi.fn(),
  inviteGuest: mocks.inviteGuest,
  undoCheckIn: vi.fn(),
}));
vi.mock("next/image", () => ({ default: () => null }));

import { GuestListFilter } from "@/components/event/GuestListFilter";

const declined = {
  id: "declined-1",
  guestName: "Declined Guest",
  guestEmail: "declined@example.com",
  guestPhone: null,
  status: "NO" as const,
  plusOneCount: 0,
  note: null,
  createdAt: "2026-07-14T17:00:00.000Z",
  answers: [],
  plusOneGuests: [],
  editToken: "declined-token",
  user: null,
  checkIn: null,
};

const invited = {
  id: "invited-1",
  rsvpId: "invited-1",
  sentTo: "invited@example.com",
  channel: "EMAIL" as const,
  sentAt: "2026-07-14T18:00:00.000Z",
  guestName: "Invited Guest",
  editToken: "invited-token",
  plusOneCount: 0,
  checkIn: null,
};

describe("guest check-in for every RSVP status", () => {
  it("shows check-in controls for declined and unanswered invited guests", () => {
    render(
      <GuestListFilter
        going={[]}
        maybe={[]}
        no={[declined]}
        invited={[invited]}
        isHost
        eventId="event-1"
        slug="party"
        timezone="America/New_York"
        channelConfig={{ email: true, sms: true }}
        t={testTheme}
      />
    );

    const declinedCard = screen
      .getByText("Declined Guest")
      .closest<HTMLElement>("div[style*='margin-bottom']");
    const invitedCard = screen
      .getByText("Invited Guest")
      .closest<HTMLElement>("div[style*='margin-bottom']");
    expect(declinedCard).not.toBeNull();
    expect(invitedCard).not.toBeNull();
    expect(within(declinedCard!).getByRole("button", { name: "Check in" })).not.toBeNull();
    expect(within(invitedCard!).getByRole("button", { name: "Check in" })).not.toBeNull();
    expect(within(invitedCard!).getByRole("button", { name: "Resend invite" })).not.toBeNull();
  });

  it("resends an unanswered invitation through the existing invite action", () => {
    mocks.inviteGuest.mockResolvedValue({ success: true, emailOrPhone: invited.sentTo });
    render(
      <GuestListFilter
        going={[]}
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

    fireEvent.click(screen.getByRole("button", { name: "Resend invite" }));
    expect(mocks.inviteGuest).toHaveBeenCalledWith("event-1", "invited@example.com");
  });
});
