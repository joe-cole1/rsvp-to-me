// @vitest-environment jsdom
import { it, expect, vi, beforeEach } from "vitest";
import { saveEventTheme } from "@/app/actions/event";
import { THEME_PRESETS } from "@/lib/theme";
import { BUILTIN_PRESENTATIONS } from "@/lib/theme-preset-presentation";
import { fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/tests/components/render";
import React from "react";
import { SettingsPage } from "@/components/event/SettingsPage";
import type { EventInput } from "@/components/event/settings-page/types";

// Mock server actions to avoid network/DB calls in unit tests
vi.mock("@/app/actions/event", () => ({
  saveEventSettings: vi.fn(),
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

beforeEach(() => {
  vi.mocked(saveEventTheme).mockReset().mockResolvedValue(undefined);
  window.history.replaceState({}, "", "/e/test-event/settings?section=theme");
});

const pressed = (el: HTMLElement) => el.getAttribute("aria-pressed");

// Root cause (01a1baab): overlapping effect autosaves hit the CAPTCHA
// action-in-progress guard and recovery restored a stale slider value.
it("queues rapid effect changes and saves the latest complete snapshot", async () => {
  window.history.replaceState({}, "", "/e/test-event/settings?section=theme");
  let release!: () => void;
  const action = vi.mocked(saveEventTheme);
  action
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    )
    .mockResolvedValue(undefined);
  const ui = render(<SettingsPage event={mockEvent} isOwner={true} />);
  fireEvent.click(await ui.findByRole("button", { name: "Effects" }));
  fireEvent.click(ui.getByRole("button", { name: "More" }));
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  fireEvent.click(ui.getByRole("button", { name: "Lively" }));
  expect(action).toHaveBeenCalledTimes(1);
  release();
  await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  expect(action.mock.calls[1][7]).toMatchObject({ effectDensity: "dense", effectSpeed: "lively" });
});

// Review gap (01a1baab): only the newest save's failure may roll the editor back.
it("restores the confirmed effect and reports the error when the newest save fails", async () => {
  vi.mocked(saveEventTheme).mockRejectedValueOnce(new Error("network"));
  const ui = render(<SettingsPage event={mockEvent} isOwner={true} />);
  fireEvent.click(await ui.findByRole("button", { name: "Effects" }));
  fireEvent.click(ui.getByRole("button", { name: "More" }));
  expect((await ui.findAllByText("Failed to save theme settings.")).length).toBeGreaterThan(0);
  expect(pressed(ui.getByRole("button", { name: "Some" }))).toBe("true");
  expect(pressed(ui.getByRole("button", { name: "More" }))).toBe("false");
});

it("ignores an older failed save once the newer queued save succeeds", async () => {
  let fail!: (error: Error) => void;
  vi.mocked(saveEventTheme).mockImplementationOnce(
    () =>
      new Promise<void>((_, reject) => {
        fail = reject;
      })
  );
  const ui = render(<SettingsPage event={mockEvent} isOwner={true} />);
  fireEvent.click(await ui.findByRole("button", { name: "Effects" }));
  fireEvent.click(ui.getByRole("button", { name: "More" }));
  await waitFor(() => expect(saveEventTheme).toHaveBeenCalledTimes(1));
  fireEvent.click(ui.getByRole("button", { name: "Lively" }));
  fail(new Error("captcha action in progress"));
  await waitFor(() => expect(saveEventTheme).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(pressed(ui.getByRole("button", { name: "Lively" }))).toBe("true"));
  expect(pressed(ui.getByRole("button", { name: "More" }))).toBe("true");
  expect(ui.queryByText("Failed to save theme settings.")).toBeNull();
});

// Review gap (01a1baab): the one-time migration is the only writer of preset
// effects. A later None on a preset-linked event must load as None, with no
// save that would re-apply the preset's default mixture.
it("keeps a saved None on a preset-linked event", async () => {
  const patricks = {
    ...THEME_PRESETS.find((p) => p.id === "st-patricks")!,
    presentation: BUILTIN_PRESENTATIONS["st-patricks"],
  };
  const event: EventInput = {
    ...mockEvent,
    theme: {
      ...mockEvent.theme!,
      baseTheme: patricks.base,
      gradientFrom: patricks.gradientFrom,
      gradientTo: patricks.gradientTo,
      accentColor: patricks.accentColor,
      appliedPresetId: patricks.id,
      effectId: null,
      effectIconIds: [],
      effectDensity: null,
      effectSpeed: null,
      effectSize: null,
    },
  };
  const ui = render(<SettingsPage event={event} isOwner={true} themePresets={[patricks]} />);
  fireEvent.click(await ui.findByRole("button", { name: "Effects" }));
  expect(pressed(ui.getByRole("button", { name: "None" }))).toBe("true");
  expect(ui.queryByRole("button", { name: /Remove/ })).toBeNull();
  expect(saveEventTheme).not.toHaveBeenCalled();
});
