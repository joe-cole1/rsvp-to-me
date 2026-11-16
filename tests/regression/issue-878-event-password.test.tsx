// #878 root cause: the UI hid active passwords outside Private and only offered
// removal after typing then clearing. It also cleared confirmed state before saves
// succeeded, making failed removals look successful. Found November 2026.
// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/tests/components/render";
import type { EventInput } from "@/components/event/settings-page/types";
const m = vi.hoisted(() => ({ save: vi.fn(), urlSave: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/app/actions/event", () => ({
  saveEventUrl: m.urlSave,
  previewEventUrl: vi.fn(),
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
  visibility: "PRIVATE",
  maybeEnabled: true,
  questionnaireEnabled: false,
  showTimestamps: true,
  passwordHash: "stored-hash",
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
  m.urlSave.mockImplementation(
    async (_id: string, input: { slug: string; visibility: string }) => ({
      success: true,
      ...input,
      randomCode: null,
    })
  );
});
afterEach(cleanup);

function openSettings(overrides: Partial<EventInput> = {}) {
  render(
    <SettingsPage event={{ ...event, ...overrides }} isOwner themePresets={[]} adminModerating />
  );
  fireEvent.click(screen.getByRole("button", { name: /Display options/ }));
}
function passwordField() {
  return screen.getByLabelText("Event password (optional)");
}
async function confirmRemoval() {
  fireEvent.click(screen.getByRole("button", { name: "Remove password" }));
  const dialog = await screen.findByRole("dialog", { name: "Remove event password?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove password" }));
}

describe("#878 visible, confirmed password management", () => {
  it.each(["PRIVATE", "UNLISTED", "PUBLIC"] as const)(
    "offers removal immediately for an existing %s password",
    (visibility) => {
      openSettings({ visibility });
      expect(passwordField()).toHaveValue("");
      expect(screen.getByText("SET")).toBeVisible();
      expect(screen.getByRole("button", { name: "Remove password" })).toBeVisible();
      expect(
        screen.getByText("Password protection stays on when you change visibility.")
      ).toBeVisible();
      expect(m.save).not.toHaveBeenCalled();
    }
  );

  it.each(["Unlisted", "Public"])(
    "keeps the active password visible after switching to %s",
    async (mode) => {
      openSettings();
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(mode) }));
      if (mode === "Unlisted") {
        const dialog = await screen.findByRole("dialog", {
          name: "This link may be easy to guess",
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Use this URL" }));
      }
      await waitFor(() =>
        expect(m.urlSave).toHaveBeenCalledWith(
          "event",
          expect.objectContaining({ visibility: mode.toUpperCase() }),
          null
        )
      );
      expect(passwordField()).toBeVisible();
      expect(screen.getByText("SET")).toBeVisible();
      expect(screen.getByRole("button", { name: "Remove password" })).toBeVisible();
    }
  );

  it("cancels removal without saving or losing the pending replacement", async () => {
    openSettings();
    fireEvent.change(passwordField(), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove password" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(m.save).not.toHaveBeenCalled();
    expect(passwordField()).toHaveValue("new-password");
    expect(screen.getByText("SET")).toBeVisible();
  });

  it("keeps the saved-password placeholder and removal control when a replacement is cleared", () => {
    openSettings();
    fireEvent.change(passwordField(), { target: { value: "replacement" } });
    fireEvent.change(passwordField(), { target: { value: "" } });
    fireEvent.blur(passwordField());
    expect(passwordField()).toHaveAttribute("placeholder", "••••••••");
    expect(screen.getByText("SET")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove password" })).toBeVisible();
    expect(m.save).not.toHaveBeenCalled();
  });

  it.each(["PRIVATE", "UNLISTED", "PUBLIC"] as const)(
    "removes a %s password only after confirmation",
    async (visibility) => {
      openSettings({ visibility });
      await confirmRemoval();
      await waitFor(() => expect(m.save).toHaveBeenCalledWith("event", { password: null }, null));
      await waitFor(() => expect(screen.queryByText("SET")).not.toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "Remove password" })).not.toBeInTheDocument();
      expect(
        screen.getByRole("radio", {
          name: new RegExp(
            visibility === "PRIVATE" ? "Private" : visibility === "PUBLIC" ? "Public" : "Unlisted"
          ),
        })
      ).toBeChecked();
      if (visibility !== "PRIVATE")
        expect(screen.queryByLabelText("Event password (optional)")).not.toBeInTheDocument();
    }
  );

  it("keeps confirmed protection during a pending removal and prevents duplicate saves", async () => {
    let finish!: (result: { success: boolean }) => void;
    m.save.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    openSettings({ visibility: "UNLISTED" });
    await confirmRemoval();
    await waitFor(() => expect(m.save).toHaveBeenCalledTimes(1));
    expect(passwordField()).toBeDisabled();
    expect(screen.getByText("SET")).toBeVisible();
    const remove = screen.getByRole("button", { name: "Remove password" });
    expect(remove).toBeDisabled();
    fireEvent.click(remove);
    expect(m.save).toHaveBeenCalledTimes(1);
    await act(async () => finish({ success: true }));
    expect(screen.queryByText("SET")).not.toBeInTheDocument();
  });

  it.each(["returned", "thrown"])(
    "keeps the password and retry control after a %s save failure",
    async (kind) => {
      if (kind === "returned")
        m.save.mockResolvedValueOnce({ success: false, error: "Could not save password." });
      else m.save.mockRejectedValueOnce(new Error("offline"));
      openSettings({ visibility: "UNLISTED" });
      await confirmRemoval();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Remove password" })).toBeEnabled()
      );
      expect(screen.getByText("SET")).toBeVisible();
      expect(passwordField()).toBeVisible();
      expect(
        screen.getByText(
          kind === "returned" ? "Could not save password." : "Failed to save settings."
        )
      ).toBeVisible();
      await confirmRemoval();
      await waitFor(() => expect(screen.queryByText("SET")).not.toBeInTheDocument());
      expect(m.save).toHaveBeenCalledTimes(2);
    }
  );

  it("confirms a first password, then requires explicit replacement without clearing a failed draft", async () => {
    openSettings({ passwordHash: null });
    const input = passwordField();
    fireEvent.change(input, { target: { value: "first-password" } });
    fireEvent.blur(input);
    await waitFor(() => expect(screen.getByText("SET")).toBeVisible());
    expect(m.save).toHaveBeenLastCalledWith("event", { password: "first-password" }, null);
    expect(passwordField()).toHaveValue("");
    fireEvent.change(passwordField(), { target: { value: "replacement" } });
    fireEvent.blur(passwordField());
    expect(m.save).toHaveBeenCalledTimes(1);
    m.save.mockResolvedValueOnce({ success: false, error: "Could not replace password." });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));
    await screen.findByText("Could not replace password.");
    expect(passwordField()).toHaveValue("replacement");
    expect(screen.getByText("SET")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save new password" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));
    await waitFor(() => expect(m.save).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(passwordField()).toHaveValue(""));
    expect(m.save).toHaveBeenLastCalledWith("event", { password: "replacement" }, null);
    expect(screen.getByRole("button", { name: "Remove password" })).toBeVisible();
  });
});
