// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { testTheme } from "./helpers/theme";

const mocks = vi.hoisted(() => ({
  checkInRsvp: vi.fn(),
  undoCheckIn: vi.fn(),
  addWalkIn: vi.fn(),
  inviteGuest: vi.fn(),
}));

vi.mock("@/app/actions/event", () => ({
  addWalkIn: mocks.addWalkIn,
  approveRsvp: vi.fn(),
  checkInRsvp: mocks.checkInRsvp,
  declineRsvp: vi.fn(),
  deleteRsvpAsHost: vi.fn(),
  inviteGuest: mocks.inviteGuest,
  undoCheckIn: mocks.undoCheckIn,
}));
vi.mock("next/image", () => ({ default: () => null }));

import { GuestListFilter } from "@/components/event/GuestListFilter";

const going = {
  id: "going-1",
  guestName: "Ada Guest",
  guestEmail: "ada@example.com",
  guestPhone: "+15550001111",
  status: "GOING" as const,
  plusOneCount: 1,
  note: null,
  createdAt: "2026-07-14T18:00:00.000Z",
  answers: [],
  plusOneGuests: ["Grace Guest"],
  editToken: "token-1",
  user: null,
  checkIn: {
    checkedInAt: "2026-07-14T20:00:00.000Z",
    checkedInBy: "host@example.com",
  },
};

const maybe = {
  ...going,
  id: "maybe-1",
  guestName: "Maybe Guest",
  guestEmail: "maybe@example.com",
  guestPhone: null,
  status: "MAYBE" as const,
  plusOneCount: 0,
  plusOneGuests: [],
  editToken: "token-2",
  checkIn: null,
};

function renderList() {
  return render(
    <GuestListFilter
      going={[going]}
      maybe={[maybe]}
      no={[]}
      invited={[]}
      isHost
      eventId="event-1"
      slug="party"
      timezone="America/New_York"
      channelConfig={{ email: true, sms: true }}
      t={testTheme}
    />
  );
}

describe("GuestListFilter attendance controls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows whole-party progress and searches host-only contact fields", () => {
    renderList();

    expect(screen.getByText(/1 of 2 parties/)).toHaveTextContent(
      "1 of 2 parties · 2 of 3 people arrived"
    );
    fireEvent.change(screen.getByLabelText("Search guest list"), {
      target: { value: "+15550001111" },
    });
    expect(screen.getByText("Ada Guest")).toBeInTheDocument();
    expect(screen.queryByText("Maybe Guest")).not.toBeInTheDocument();
  });

  it("filters to eligible parties that have not arrived", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /Not arrived/ }));

    expect(screen.getByText("Maybe Guest")).toBeInTheDocument();
    expect(screen.queryByText("Ada Guest")).not.toBeInTheDocument();
  });

  it("optimistically checks in and reconciles the server timestamp", async () => {
    mocks.checkInRsvp.mockResolvedValue({
      success: true,
      checkIn: {
        checkedInAt: new Date("2026-07-14T21:00:00.000Z"),
        checkedInBy: "host@example.com",
      },
    });
    renderList();

    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    expect(screen.getAllByText("✓ Arrived")).toHaveLength(2);
    await waitFor(() => expect(mocks.checkInRsvp).toHaveBeenCalledWith("maybe-1"));
    await waitFor(() => expect(screen.getByText(/2 of 2 parties/)).toBeInTheDocument());
  });
});
