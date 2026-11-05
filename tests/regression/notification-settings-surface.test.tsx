// @vitest-environment jsdom
// Regression (01a1a105 QC): notification settings misled or stranded people.
//
// Found: 2026-11-05 local QC (browser walkthrough, aborted server actions, a11y tree).
// 1. A failed first load left "Loading preferences…" on screen forever with no retry.
// 2. Organizers saw guest-only copy ("Only this RSVP's contacts…"), and masking showed two
//    different addresses as the same "r•••@example.test"; "Use … for this event" appeared
//    even for the address already in use.
// 3. The shared settings switch was an unnamed button with no on/off state.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/tests/components/render";
import { managementFixture } from "@/tests/helpers/notification-management";
import { Toggle } from "@/components/event/settings-page/ui";
import { APP_SHELL_THEME } from "@/lib/theme";
const m = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/app/actions/notifications", () => ({
  getNotificationManagement: m.get,
  saveNotificationPreferences: vi.fn(),
  beginNotificationProof: vi.fn(),
  completeNotificationProof: vi.fn(),
  removeNotificationConnection: vi.fn(),
  bindNotificationConnection: vi.fn(),
}));
vi.mock("@/components/ui/CaptchaProvider", () => ({ useCaptcha: () => ({}) }));
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";

beforeEach(() => vi.clearAllMocks());

describe("notification settings surface", () => {
  it("shows a load failure with a retry instead of loading forever", async () => {
    m.get.mockRejectedValueOnce(new Error("network"));
    m.get.mockResolvedValueOnce({ success: true, data: managementFixture() });
    render(<NotificationPreferences scope={{ kind: "rsvp", slug: "party", token: "private" }} />);
    expect(await screen.findByText("Could not load these settings.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(m.get).toHaveBeenCalledTimes(2));
    expect(
      (
        await screen.findByRole("switch", { name: "Use my profile settings for this event" })
      ).getAttribute("aria-checked")
    ).toBe("true");
  });
  it("gives organizers organizer copy and offers only connections not already in use", async () => {
    m.get.mockResolvedValue({
      success: true,
      data: managementFixture({
        kind: "organizer",
        categories: ["host_alerts"],
        rows: [{ category: "host_alerts", channels: ["email"] }],
        hostAlertsEnabled: true,
        contacts: [
          { channel: "email", destination: "r•••s@example.test", state: "verified" },
          { channel: "sms", destination: null, state: "missing" },
        ],
        connections: [
          { id: "bound", channel: "email", destination: "r•••s@example.test", bound: true },
          { id: "other", channel: "sms", destination: "•••• 2222", bound: false },
        ],
      }),
    });
    render(<NotificationPreferences scope={{ kind: "organizer", eventId: "event" }} embedded />);
    expect(await screen.findByText(/Alerts use your account contacts/)).toBeTruthy();
    expect(screen.queryByText(/Only this RSVP/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Use r•••s@example.test for this event" })
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Use •••• 2222 for this event" })).toBeTruthy();
    // One table row: host alerts, by channel.
    expect(screen.getByRole("checkbox", { name: "Host alerts: Email" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /Event updates/ })).toBeNull();
  });
  it("names every settings switch and exposes its state", () => {
    const change = vi.fn();
    render(
      <Toggle label="Notify organizers" value={false} onChange={change} t={APP_SHELL_THEME} />
    );
    const toggle = screen.getByRole("switch", { name: "Notify organizers" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.getAttribute("type")).toBe("button");
    fireEvent.click(toggle);
    expect(change).toHaveBeenCalledWith(true);
  });
});
