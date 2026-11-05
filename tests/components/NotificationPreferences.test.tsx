import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@/tests/components/render";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import type { ManagementData } from "@/lib/notifications/manage";
import { managementFixture, profileFixture } from "@/tests/helpers/notification-management";
const m = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  begin: vi.fn(),
  complete: vi.fn(),
  remove: vi.fn(),
  bind: vi.fn(),
}));
vi.mock("@/app/actions/notifications", () => ({
  getNotificationManagement: m.get,
  saveNotificationPreferences: m.save,
  beginNotificationProof: m.begin,
  completeNotificationProof: m.complete,
  removeNotificationConnection: m.remove,
  bindNotificationConnection: m.bind,
}));
vi.mock("@/components/ui/CaptchaProvider", () => ({
  useCaptcha: () => ({
    runWithCaptcha: async (_action: string, operation: (token: string) => Promise<unknown>) =>
      operation("fixture-captcha"),
  }),
}));
const profile = { kind: "profile" } as const;
const rsvp = { kind: "rsvp", slug: "party", token: "private" } as const;
let current: ManagementData;
const use = (data: ManagementData) => {
  current = data;
  m.get.mockResolvedValue({ success: true, data });
};
beforeEach(() => {
  vi.clearAllMocks();
  use(profileFixture());
  // The server echoes what it stored, so the editor converges on the saved state.
  m.save.mockImplementation(async (_scope, input) => ({
    success: true,
    data: {
      ...current,
      revision: input.revision + 1,
      own: current.kind === "profile" || input.categories.length > 0,
      rows: input.categories.length ? input.categories : current.rows,
    },
  }));
});
const lastSave = () => m.save.mock.calls.at(-1)![1];
const box = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;

describe("profile table", () => {
  it("shows what you get × where, with every checked box getting a copy", async () => {
    render(<NotificationPreferences scope={profile} />);
    const table = await screen.findByRole("table", { name: "What you get and where" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent)
    ).toEqual(["Message", "Email", "Text"]);
    expect(within(table).getAllByRole("rowheader")).toHaveLength(4);
    expect(screen.getByText(/Each message goes to every place you check/)).toBeTruthy();
    expect(box("Event updates: Email").checked).toBe(true);
    // No ordering, no delivery mode, no Save button to forget.
    expect(screen.queryByRole("button", { name: /Move/ })).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
  });
  it("saves every row when one box changes, keeping the channel order", async () => {
    render(<NotificationPreferences scope={profile} />);
    await screen.findByRole("table");
    fireEvent.click(box("Reminders and nudges: Text"));
    await waitFor(() => expect(m.save).toHaveBeenCalled());
    expect(lastSave()).toEqual({
      revision: 0,
      categories: [
        { category: "updates", channels: ["email", "sms"] },
        { category: "reminders", channels: ["email"] },
        { category: "confirmations", channels: ["email", "sms"] },
        { category: "host_alerts", channels: ["email", "sms"] },
      ],
    });
    expect(await screen.findByText("Reminders and nudges: Text is off.")).toBeTruthy();
    expect(box("Reminders and nudges: Text").checked).toBe(false);
  });
  it("restores the confirmed state and shows the error when a save fails", async () => {
    m.save.mockResolvedValue({
      success: false,
      error: "Settings changed. Reload before saving again.",
    });
    render(<NotificationPreferences scope={profile} />);
    await screen.findByRole("table");
    fireEvent.click(box("Event updates: Email"));
    expect(await screen.findByText("Settings changed. Reload before saving again.")).toBeTruthy();
    expect(box("Event updates: Email").checked).toBe(true);
  });
  it("hides channels the site does not offer everywhere", async () => {
    use(profileFixture({ offered: ["email"] }));
    render(<NotificationPreferences scope={profile} />);
    await screen.findByRole("table");
    expect(screen.queryByRole("checkbox", { name: /Text/ })).toBeNull();
    expect(screen.queryByText("Text")).toBeNull();
  });
  it("points to the event for single-event settings instead of nesting them", async () => {
    render(<NotificationPreferences scope={profile} />);
    expect(await screen.findByText("Settings for one event")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("profile contact info", () => {
  it("groups addresses by channel with a minus to remove each", async () => {
    use(
      profileFixture({
        connections: [
          { id: "c1", channel: "email", destination: "r•••s@example.test", bound: false },
        ],
      })
    );
    m.remove.mockResolvedValue({ success: true, data: profileFixture() });
    render(<NotificationPreferences scope={profile} />);
    expect(await screen.findByText("r•••s@example.test")).toBeTruthy();
    expect(screen.getByText("None yet.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove r•••s@example.test" }));
    await waitFor(() => expect(m.remove).toHaveBeenCalledWith(profile, "email"));
  });
  it("adds an address from the plus button and never treats verification as consent", async () => {
    m.begin.mockResolvedValue({ success: true, data: { challengeId: "challenge" } });
    m.complete.mockResolvedValue({ success: true, data: profileFixture() });
    render(<NotificationPreferences scope={profile} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    // Both channels are free, so the form asks which kind first; email is picked.
    fireEvent.click(screen.getByRole("radio", { name: "Text" }));
    fireEvent.click(screen.getByRole("radio", { name: "Email" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() =>
      expect(m.begin).toHaveBeenCalledWith(
        profile,
        { channel: "email", destination: "new@example.com" },
        "fixture-captcha"
      )
    );
    fireEvent.change(await screen.findByLabelText("Verification code"), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() =>
      expect(m.complete).toHaveBeenCalledWith(profile, {
        challengeId: "challenge",
        code: "12345678",
      })
    );
    expect(await screen.findByText("Verified.")).toBeTruthy();
    expect(m.save).not.toHaveBeenCalled();
  });
  it("offers only channels that don't have an address yet", async () => {
    use(
      profileFixture({
        connections: [
          { id: "c1", channel: "email", destination: "r•••s@example.test", bound: false },
          { id: "c2", channel: "sms", destination: "•••• 2222", bound: false },
        ],
      })
    );
    render(<NotificationPreferences scope={profile} />);
    await screen.findByText("•••• 2222");
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
  });
});

describe("event preferences", () => {
  it("follows the profile with the table shown read-only until the event gets its own", async () => {
    use(managementFixture());
    render(<NotificationPreferences scope={rsvp} />);
    const follow = await screen.findByRole("switch", {
      name: "Use my profile settings for this event",
    });
    expect(follow.getAttribute("aria-checked")).toBe("true");
    expect(box("Event updates: Email").disabled).toBe(true);
    fireEvent.click(follow);
    // Turning it off copies what the profile gives into this event's own rows.
    await waitFor(() =>
      expect(lastSave()).toEqual({ revision: 0, categories: managementFixture().rows })
    );
    await waitFor(() => expect(box("Event updates: Email").disabled).toBe(false));
  });
  it("following the profile again writes no rows", async () => {
    use(managementFixture({ own: true }));
    render(<NotificationPreferences scope={rsvp} />);
    fireEvent.click(
      await screen.findByRole("switch", { name: "Use my profile settings for this event" })
    );
    await waitFor(() => expect(lastSave()).toEqual({ revision: 0, categories: [] }));
  });
  it("a guest without an account edits the table directly", async () => {
    use(managementFixture({ linked: false }));
    render(<NotificationPreferences scope={rsvp} />);
    await screen.findByRole("table");
    expect(screen.queryByRole("switch")).toBeNull();
    fireEvent.click(box("Event updates: Text"));
    await waitFor(() =>
      expect(lastSave().categories).toContainEqual({ category: "updates", channels: ["email"] })
    );
  });
  it("says when a checked channel can't be used, and shows each contact's state", async () => {
    use(
      managementFixture({
        contacts: [
          { channel: "email", destination: "g•••t@example.com", state: "paused" },
          { channel: "sms", destination: null, state: "missing" },
        ],
      })
    );
    render(<NotificationPreferences scope={rsvp} />);
    expect(
      await screen.findByText(
        "Email can’t be used for this event until its contact below is ready."
      )
    ).toBeTruthy();
    expect(screen.getByText("Paused")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Verify" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  });
});
