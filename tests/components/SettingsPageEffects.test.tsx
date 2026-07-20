// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { SettingsPage } from "@/components/event/SettingsPage";
import type { EventInput } from "@/components/event/settings-page/types";

// Mock server actions to avoid network/DB calls in unit tests
vi.mock("@/app/actions/event", () => ({
  saveEventSettings: vi.fn(),
  saveEventTheme: vi.fn(),
  saveReminderSettings: vi.fn(),
  addCoHost: vi.fn(),
  removeCoHost: vi.fn(),
  updateCoHostDisplayName: vi.fn(),
  cancelCoHostInvitation: vi.fn(),
  addRsvpField: vi.fn(),
  updateRsvpField: vi.fn(),
  deleteRsvpField: vi.fn(),
  createPoll: vi.fn(),
  deletePoll: vi.fn(),
  addPollOption: vi.fn(),
  deletePollOption: vi.fn(),
  updatePollSettings: vi.fn(),
  addPotluckItem: vi.fn(),
  removePotluckItem: vi.fn(),
  unclaimPotluckItem: vi.fn(),
}));

const mockEvent: EventInput = {
  id: "evt-1",
  slug: "test-event",
  title: "Test Event",
  hostId: "user-1",
  host: { id: "user-1", name: "Host User", email: "host@example.com" },
  commentsEnabled: true,
  plusOneAllowed: true,
  plusOneMax: 2,
  plusOneNamesRequired: false,
  guestSharingEnabled: true,
  guestsCanInvite: true,
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
  theme: {
    baseTheme: "DARK",
    gradientFrom: "#7c3aed",
    gradientTo: "#1e40af",
    accentColor: "#a855f7",
    coverImageUrl: null,
    effectId: "confetti",
    effectDensity: "medium",
    effectSpeed: "medium",
    effectSize: 1,
  },
  reminderSettings: null,
  coHosts: [],
  coHostInvitations: [],
  rsvpFields: [],
  polls: [],
  potluckItems: [],
};

describe("SettingsPage effect layer", () => {
  it("renders ParticleLayer with active effect on settings page", () => {
    const { container } = render(
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

    const effectLayer = container.querySelector(".rsvp-effect-layer");
    expect(effectLayer).toBeTruthy();
    expect(effectLayer?.getAttribute("data-effect-id")).toBe("confetti");
  });
});
