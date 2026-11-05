// @vitest-environment jsdom
// #754 (2026-10-22): a guest invited as `Alice <alice@…>` RSVPed and was told
// "Since you didn't add an email or phone, copy this link…".
// Root cause: RsvpFlow gated the copy-link box on its own create-form email and
// phone state, which is always empty in edit mode, and the RSVP page never said
// the RSVP already had a contact. The page now passes a `hasContact` boolean
// (never the contact itself); hosts editing a contactless guest get host wording.
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/tests/components/render";
import { testTheme } from "@/tests/components/helpers/theme";

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

const event = {
  id: "event-1",
  slug: "party",
  title: "Party",
  startAt: new Date("2030-12-01T20:00:00Z"),
  endAt: null,
  timezone: "UTC",
  locationName: null,
  plusOneAllowed: false,
  plusOneMax: 0,
  plusOneNamesRequired: false,
  maybeEnabled: true,
  questionnaireEnabled: false,
  rsvpFields: [],
};

function invited(hasContact: boolean) {
  return {
    id: "rsvp-1",
    editToken: "tok-754",
    guestName: "Alice",
    status: "GOING" as const,
    plusOneCount: 0,
    note: null,
    plusOneGuests: [],
    answers: [],
    hasContact,
    responded: false,
  };
}

const GUEST_WARNING = "⚠️ Save your Edit Link";
const ON_FILE = /from the link in your invitation or confirmation message/;
const HOST_BOX = "This guest's edit link";

async function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Confirm RSVP|Update RSVP/ }));
  await waitFor(() => expect(screen.getByText(/You're in!|RSVP updated!/)).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateRSVP.mockResolvedValue({ success: true });
  mockUpdateRsvpAsHost.mockResolvedValue({ success: true });
  mockAddRSVP.mockResolvedValue({ success: true, id: "rsvp-1", editToken: "tok-new" });
});

describe("#754 edit-link box on the RSVP done screen", () => {
  it("tells an invitee with a contact on file where their link is, without the warning", async () => {
    render(<RsvpFlow event={event} theme={testTheme} existingRsvp={invited(true)} />);
    await submit();
    expect(screen.queryByText(GUEST_WARNING)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Keep your private RSVP edit link" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Manage notifications for this event" })
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/tok-754/)).not.toBeInTheDocument();
  });

  it("still offers the copy box to a guest with no contact on file", async () => {
    render(<RsvpFlow event={event} theme={testTheme} existingRsvp={invited(false)} />);
    await submit();
    expect(screen.getByText(GUEST_WARNING)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/\/e\/party\?token=tok-754$/)).toBeInTheDocument();
    expect(screen.queryByText(ON_FILE)).not.toBeInTheDocument();
  });

  it("gives a host editing a contactless guest a host-worded copy box", async () => {
    render(
      <RsvpFlow event={event} theme={testTheme} existingRsvp={invited(false)} organizerOverride />
    );
    await submit();
    expect(screen.getByText(HOST_BOX)).toBeInTheDocument();
    expect(screen.getByText(/This guest has no email or phone on file/)).toBeInTheDocument();
    expect(screen.queryByText(GUEST_WARNING)).not.toBeInTheDocument();
  });

  it("shows a host editing a guest with a contact neither box nor guest reassurance", async () => {
    render(
      <RsvpFlow event={event} theme={testTheme} existingRsvp={invited(true)} organizerOverride />
    );
    await submit();
    expect(screen.queryByText(HOST_BOX)).not.toBeInTheDocument();
    expect(screen.queryByText(GUEST_WARNING)).not.toBeInTheDocument();
    expect(screen.queryByText(ON_FILE)).not.toBeInTheDocument();
  });

  it("keeps the create-form behavior: a typed email replaces the warning with the reassurance", async () => {
    render(<RsvpFlow event={event} theme={testTheme} initialStatus="GOING" />);
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Bea" },
    });
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "bea@example.com" },
    });
    await submit();
    expect(screen.queryByText(GUEST_WARNING)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Keep your private RSVP edit link" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Manage notifications for this event" })
    ).toBeInTheDocument();
  });

  // 01a1a105 QC (D3): a public answer merged into an invitation gets no private token, so
  // the screen says where the link went instead of showing anyone the invitee's links.
  it("points an answer merged into an invitation to its message, with no private links", async () => {
    mockAddRSVP.mockResolvedValue({ success: true, id: "rsvp-1", editToken: null });
    render(<RsvpFlow event={event} theme={testTheme} initialStatus="GOING" />);
    fireEvent.change(screen.getByPlaceholderText("Your name (required)"), {
      target: { value: "Bea" },
    });
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "invitee@example.com" },
    });
    await submit();
    expect(screen.getByText(ON_FILE)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Keep your private RSVP edit link" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Manage notifications for this event" })).toBeNull();
  });
});
