// #853 root cause: every auto-save rebuilt the entire settings payload from stale
// component state, reverting other tabs' visibility, capacity and display choices.
// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@/tests/components/render";
import type { EventInput } from "@/components/event/settings-page/types";
const m = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/app/actions/event", () => ({
  saveEventSettings: m.save,
  saveEventTheme: vi.fn(),
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
vi.mock("@/components/event/EventAtmosphere", () => ({ EventAtmosphere: () => null }));
vi.mock("@/components/notifications/NotificationPreferences", () => ({
  NotificationPreferences: () => null,
}));
vi.mock("@/components/notifications/ReminderSchedule", () => ({ ReminderSchedule: () => null }));
import { SettingsPage } from "@/components/event/SettingsPage";
const event: EventInput = {
  id: "event",
  slug: "party",
  title: "Party",
  hostId: "host",
  host: { id: "host", name: "Host", email: "host@example.test" },
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
  theme: null,
  reminderSettings: null,
  coHosts: [],
  coHostInvitations: [],
  rsvpFields: [],
  polls: [],
  potluckItems: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/e/party/settings");
  m.save.mockResolvedValue({ success: true });
});
afterEach(cleanup);
describe("#853 settings patches", () => {
  it("preserves a newer tab's visibility and capacity while saving a comment toggle", async () => {
    const stored = { visibility: "PRIVATE", capacity: 25, commentsEnabled: true };
    m.save.mockImplementation(async (_id, patch) => {
      Object.assign(stored, patch);
      return { success: true };
    });
    render(<SettingsPage event={event} isOwner themePresets={[]} adminModerating />);
    fireEvent.click(screen.getByRole("button", { name: /Display options/ }));
    fireEvent.click(screen.getByRole("switch", { name: "Allow guest comments" }));
    await waitFor(() =>
      expect(m.save).toHaveBeenCalledWith("event", { commentsEnabled: false }, null)
    );
    expect(stored).toEqual({ visibility: "PRIVATE", capacity: 25, commentsEnabled: false });
  });
  it("sends just the visibility field, without copying display defaults", async () => {
    render(<SettingsPage event={event} isOwner themePresets={[]} adminModerating />);
    fireEvent.click(screen.getByRole("button", { name: /Display options/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Unlisted/ }));
    await waitFor(() =>
      expect(m.save).toHaveBeenCalledWith("event", { visibility: "UNLISTED" }, null)
    );
  });
});
