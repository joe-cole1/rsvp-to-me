// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { testTheme } from "./helpers/theme";

const { mockAddRSVP, mockUpdateRSVP, mockUpdateRsvpAsHost } = vi.hoisted(() => ({
  mockAddRSVP: vi.fn(),
  mockUpdateRSVP: vi.fn(),
  mockUpdateRsvpAsHost: vi.fn(),
}));

vi.mock("@/app/actions/event", () => ({
  addRSVP: mockAddRSVP,
  updateRSVP: mockUpdateRSVP,
  updateRsvpAsHost: mockUpdateRsvpAsHost,
}));

import { RsvpFlow } from "@/components/rsvp/RsvpFlow";

const baseEvent = {
  id: "event-1",
  slug: "test-party",
  title: "Test Party",
  startAt: new Date("2030-12-01T20:00:00Z"),
  endAt: null,
  timezone: "America/New_York",
  locationName: "My House",
  plusOneAllowed: false,
  plusOneMax: 0,
  plusOneNamesRequired: false,
  maybeEnabled: true,
  questionnaireEnabled: false,
  rsvpFields: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RsvpFlow — new RSVP", () => {
  it("renders Going, Maybe, and Can't go buttons", () => {
    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );
    expect(screen.getByText("Going")).toBeInTheDocument();
    expect(screen.getByText("Maybe")).toBeInTheDocument();
    expect(screen.getByText("Can't go")).toBeInTheDocument();
  });

  it("does not render Maybe button when maybeEnabled is false", () => {
    render(
      <RsvpFlow
        event={{ ...baseEvent, maybeEnabled: false }}
        theme={testTheme}
        initialStatus="GOING"
        sessionUser={null}
      />
    );
    expect(screen.queryByText("Maybe")).not.toBeInTheDocument();
  });

  it("renders name input with required placeholder", () => {
    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );
    expect(screen.getByPlaceholderText("Your name (required)")).toBeInTheDocument();
  });

  it("submit button is disabled when name is empty", () => {
    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );
    const btn = screen.getByText("Confirm RSVP");
    expect(btn).toBeDisabled();
  });

  it("submit button is enabled after typing a name", () => {
    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Alice" },
    });
    expect(screen.getByText("Confirm RSVP")).not.toBeDisabled();
  });

  it("shows confirmation screen after successful RSVP submission", async () => {
    mockAddRSVP.mockResolvedValue({ success: true, id: "rsvp-1", editToken: "tok-abc" });

    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByText("Confirm RSVP"));

    await waitFor(() => {
      expect(screen.getByText("You're in!")).toBeInTheDocument();
    });
  });

  it("shows inline error when addRSVP returns failure", async () => {
    mockAddRSVP.mockResolvedValue({ success: false, error: "Event is at capacity" });

    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Bob" },
    });
    fireEvent.click(screen.getByText("Confirm RSVP"));

    await waitFor(() => {
      expect(screen.getByText("Event is at capacity")).toBeInTheDocument();
    });
  });

  it("shows 'Noted!' on confirmation for MAYBE status", async () => {
    mockAddRSVP.mockResolvedValue({ success: true, id: "rsvp-1", editToken: "tok-abc" });

    render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="MAYBE" sessionUser={null} />
    );
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Carol" },
    });
    fireEvent.click(screen.getByText("Confirm RSVP"));

    await waitFor(() => {
      expect(screen.getByText("Noted!")).toBeInTheDocument();
    });
  });
});

// Regression (ROADMAP "RSVP Flow Confirmation Race Condition", found during the
// [89d70d] themes E2E audit): after a successful *create*, the Server Action's
// automatic page refresh re-requests the RSC payload with the new ?token= URL,
// so the server passes `existingRsvp` down and the still-mounted RsvpFlow
// flipped `isEdit` to true — transiently swapping the "You're in!" success
// heading to "RSVP updated!". The `justCreated` flag pins the create heading
// for the RSVP created in this mount. The rerender below simulates the RSC
// refresh delivering the new props.
describe("RsvpFlow — confirmation heading race (create → RSC refresh)", () => {
  it("keeps 'You're in!' when existingRsvp arrives after a create", async () => {
    mockAddRSVP.mockResolvedValue({ success: true, id: "rsvp-1", editToken: "tok-abc" });

    const { rerender } = render(
      <RsvpFlow event={baseEvent} theme={testTheme} initialStatus="GOING" sessionUser={null} />
    );
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByText("Confirm RSVP"));
    await waitFor(() => {
      expect(screen.getByText("You're in!")).toBeInTheDocument();
    });

    rerender(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        initialStatus="GOING"
        sessionUser={null}
        existingRsvp={{
          id: "rsvp-1",
          editToken: "tok-abc",
          guestName: "Alice",
          status: "GOING" as const,
          plusOneCount: 0,
          note: null,
          plusOneGuests: [],
          answers: [],
        }}
      />
    );

    expect(screen.getByText("You're in!")).toBeInTheDocument();
    expect(screen.queryByText("RSVP updated!")).not.toBeInTheDocument();
  });
});

describe("RsvpFlow — edit mode", () => {
  const existingRsvp = {
    id: "rsvp-1",
    editToken: "tok-abc",
    guestName: "Alice",
    status: "GOING" as const,
    plusOneCount: 0,
    note: null,
    plusOneGuests: [],
    answers: [],
  };

  it("renders in edit mode with guest name displayed as text", () => {
    render(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        existingRsvp={existingRsvp}
        sessionUser={null}
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    // Name input should not be present in edit mode
    expect(screen.queryByPlaceholderText("Your name (required)")).not.toBeInTheDocument();
  });

  it("shows 'Update RSVP' button in edit mode", () => {
    render(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        existingRsvp={existingRsvp}
        sessionUser={null}
      />
    );
    expect(screen.getByRole("button", { name: "Update RSVP" })).toBeInTheDocument();
  });

  it("shows 'RSVP updated!' on successful update", async () => {
    mockUpdateRSVP.mockResolvedValue({ success: true });

    render(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        existingRsvp={existingRsvp}
        sessionUser={null}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Update RSVP" }));

    await waitFor(() => {
      expect(screen.getByText("RSVP updated!")).toBeInTheDocument();
    });
  });

  it("renders a read-only summary after event-start locking", () => {
    render(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        existingRsvp={existingRsvp}
        sessionUser={null}
        readOnlyReason="This event has started, so guests can no longer change their RSVP."
      />
    );

    expect(screen.getByText("RSVP editing is closed")).toBeInTheDocument();
    expect(screen.getByText("Going · Party of 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update RSVP" })).not.toBeInTheDocument();
  });

  it("uses the authenticated organizer update action in override mode", async () => {
    mockUpdateRsvpAsHost.mockResolvedValue({ success: true });
    render(
      <RsvpFlow
        event={baseEvent}
        theme={testTheme}
        existingRsvp={existingRsvp}
        sessionUser={null}
        organizerOverride
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Update RSVP" }));
    await waitFor(() =>
      expect(mockUpdateRsvpAsHost).toHaveBeenCalledWith("rsvp-1", expect.any(Object))
    );
    expect(mockUpdateRSVP).not.toHaveBeenCalled();
  });
});
