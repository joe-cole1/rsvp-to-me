// An unlinked invitation history row only showed “Resend invite,” leaving hosts
// unable to remove an obsolete card after the guest had RSVP’d separately.
//
// Fix: orphaned invitations now expose a host-authorized Remove action that
// deletes only the invitation history, never the guest's RSVP.

// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { testTheme } from "@/tests/components/helpers/theme";

const mocks = vi.hoisted(() => ({ deleteInvitationAsHost: vi.fn() }));

vi.mock("@/app/actions/event", () => ({
  addWalkIn: vi.fn(),
  approveRsvp: vi.fn(),
  checkInRsvp: vi.fn(),
  declineRsvp: vi.fn(),
  deleteInvitationAsHost: mocks.deleteInvitationAsHost,
  deleteRsvpAsHost: vi.fn(),
  inviteGuest: vi.fn(),
  undoCheckIn: vi.fn(),
}));
vi.mock("next/image", () => ({ default: () => null }));

import { GuestListFilter } from "@/components/event/GuestListFilter";

const orphanedInvitation = {
  id: "invite-history-1",
  sentTo: "alice@example.com",
  channel: "EMAIL" as const,
  sentAt: "2026-07-10T18:00:00.000Z",
};

describe("orphaned invitation removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("removes an unlinked invitation without requiring an RSVP edit token", async () => {
    mocks.deleteInvitationAsHost.mockResolvedValue({ success: true });
    render(
      <GuestListFilter
        going={[]}
        maybe={[]}
        no={[]}
        invited={[orphanedInvitation]}
        isHost
        eventId="event-1"
        slug="party"
        timezone="America/New_York"
        channelConfig={{ email: true, sms: true }}
        t={testTheme}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(mocks.deleteInvitationAsHost).toHaveBeenCalledWith("invite-history-1")
    );
    await waitFor(() => expect(screen.queryByText("alice@example.com")).toBeNull());
  });
});
