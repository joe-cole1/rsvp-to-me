// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/tests/components/render";
import React from "react";
import { SettingsPage } from "@/components/event/SettingsPage";
import type { EventInput } from "@/components/event/settings-page/types";

const mocks = vi.hoisted(() => ({
  addRsvpField: vi.fn(),
  updateRsvpField: vi.fn(),
  deleteRsvpField: vi.fn(),
}));

vi.mock("@/app/actions/event", () => ({
  saveEventSettings: vi.fn(),
  saveEventTheme: vi.fn(),
  addCoHost: vi.fn(),
  removeCoHost: vi.fn(),
  updateCoHostDisplayName: vi.fn(),
  cancelCoHostInvitation: vi.fn(),
  addRsvpField: mocks.addRsvpField,
  updateRsvpField: mocks.updateRsvpField,
  deleteRsvpField: mocks.deleteRsvpField,
  createPoll: vi.fn(),
  deletePoll: vi.fn(),
  addPollOption: vi.fn(),
  deletePollOption: vi.fn(),
  updatePollSettings: vi.fn(),
  addPotluckItem: vi.fn(),
  removePotluckItem: vi.fn(),
  unclaimPotluckItem: vi.fn(),
}));

vi.mock("@/components/event/EventAtmosphere", () => ({ EventAtmosphere: () => null }));

const mockEvent: EventInput = {
  id: "evt-1",
  slug: "test-event",
  title: "Test Event",
  hostId: "user-1",
  host: { id: "user-1", name: "Host User", email: "host@example.com" },
  rsvpEnabled: true,
  commentsEnabled: true,
  plusOneAllowed: false,
  plusOneMax: 0,
  plusOneNamesRequired: false,
  guestSharingEnabled: true,
  guestsCanInvite: false,
  approvalRequired: false,
  rsvpDeadline: null,
  allowEditAfterDeadline: true,
  capacity: null,
  guestListVis: "ALL",
  visibility: "PUBLIC",
  maybeEnabled: true,
  questionnaireEnabled: false,
  showTimestamps: true,
  passwordHash: null,
  hostDisplayName: null,
  hostAlertEmail: true,
  hostAlertSms: false,
  theme: null,
  reminderSettings: null,
  coHosts: [],
  coHostInvitations: [],
  rsvpFields: [
    {
      id: "f-addr",
      label: "Mailing address",
      description: null,
      fieldType: "ADDRESS",
      required: false,
      goingOnly: true,
      options: null,
      order: 0,
    },
    {
      id: "f-terms",
      label: "Waiver",
      description: null,
      fieldType: "TERMS",
      required: true,
      goingOnly: true,
      options: JSON.stringify({ text: "House rules", url: "https://example.com/rules" }),
      order: 1,
    },
  ],
  polls: [],
  potluckItems: [],
  questionnaireResponses: [
    {
      id: "rsvp:1",
      respondentName: "Ada",
      submittedAt: "2030-01-01T00:00:00.000Z",
      source: "rsvp",
      answers: {
        "f-addr": JSON.stringify({ line1: "10 Downing St", city: "London", postalCode: "SW1A" }),
        "f-terms": "ACCEPTED",
      },
    },
  ],
};

describe("QuestionnairePanel templates, typed fields, and responses (#786)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/e/test-event/settings?section=questionnaire");
  });

  it("shows the 6 quick-add templates (no song request) and prefills Emergency contact blurb", async () => {
    render(
      <SettingsPage
        event={mockEvent}
        isOwner={true}
        themePresets={[]}
        sessionUser={{
          id: "user-1",
          email: "host@example.com",
          name: "Host User",
          avatarUrl: null,
          role: "HOST",
        }}
      />
    );

    await screen.findByText("Quick-add templates");
    expect(screen.queryByRole("button", { name: /Song request/i })).not.toBeInTheDocument();

    for (const label of [
      "Mailing address",
      "Phone number",
      "Dietary restrictions",
      "Emergency contact",
      "Accessibility",
      "Terms / waiver",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "Emergency contact" }));
    expect(screen.getByDisplayValue("Emergency contact (name & phone)")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/urgent safety or medical situation/i)).toBeInTheDocument();
  });

  it("supports Terms / waiver scrolling textarea and external link, and validates invalid URL", async () => {
    mocks.addRsvpField.mockResolvedValue({ success: true, id: "f-new" });

    render(
      <SettingsPage
        event={mockEvent}
        isOwner={true}
        themePresets={[]}
        sessionUser={{
          id: "user-1",
          email: "host@example.com",
          name: "Host User",
          avatarUrl: null,
          role: "HOST",
        }}
      />
    );

    await screen.findByText("Quick-add templates");
    // Formatted responses display
    expect(screen.getByText(/10 Downing St, London, SW1A/)).toBeInTheDocument();
    expect(screen.getByText(/Agreed/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Terms / waiver" }));
    const termsTextarea = screen.getAllByPlaceholderText(/Paste full terms/i).at(-1)!;
    expect(termsTextarea).toHaveStyle({ overflowY: "auto" });
    fireEvent.change(termsTextarea, { target: { value: "Line 1\nLine 2\nLine 3" } });

    const urlInput = screen.getAllByPlaceholderText("https://example.com/waiver").at(-1)!;
    fireEvent.change(urlInput, { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Question" }));
    expect(screen.getByText("Enter a valid http:// or https:// link.")).toBeInTheDocument();
    expect(mocks.addRsvpField).not.toHaveBeenCalled();

    fireEvent.change(urlInput, { target: { value: "https://example.com/terms" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Question" }));
    await waitFor(() =>
      expect(mocks.addRsvpField).toHaveBeenCalledWith(
        "evt-1",
        expect.objectContaining({
          fieldType: "TERMS",
          goingOnly: true,
          required: true,
          options: JSON.stringify({
            text: "Line 1\nLine 2\nLine 3",
            url: "https://example.com/terms",
          }),
        }),
        null
      )
    );
  });
});
