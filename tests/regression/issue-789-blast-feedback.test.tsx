// @vitest-environment jsdom
// #789 root cause: the manual composer called requested recipients "sent", hiding
// opt-outs, uncertain submissions and earlier successes after a later channel failure.
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@/tests/components/render";
import { testTheme } from "@/tests/components/helpers/theme";
import type { DeliverySummary } from "@/lib/notifications/types";
import english from "@/messages/en-US.json";
import dutch from "@/messages/nl-NL.json";
import german from "@/messages/de-DE.json";
import spanish from "@/messages/es-ES.json";
const m = vi.hoisted(() => ({ email: vi.fn(), sms: vi.fn() }));
vi.mock("@/app/actions/event", () => ({
  sendBlast: m.email,
  sendSmsBlast: m.sms,
  saveEventSettings: vi.fn(),
  previewGuestInvitations: vi.fn(),
  sendGuestInvitations: vi.fn(),
}));
import { HostBar } from "@/components/event/HostBar";

const result = (summary: DeliverySummary, success = true) => ({
  success,
  sent: summary.accepted,
  summary,
});
beforeEach(() => {
  vi.clearAllMocks();
  m.email.mockResolvedValue(result({ accepted: 1, skipped: 0, failed: 0, uncertain: 0 }));
  m.sms.mockResolvedValue(result({ accepted: 0, skipped: 1, failed: 0, uncertain: 0 }));
});
afterEach(cleanup);
function open() {
  render(<HostBar eventId="event" eventSlug="party" theme={testTheme} visibility="PUBLIC" />);
  fireEvent.click(screen.getByRole("button", { name: "Message" }));
  fireEvent.change(screen.getByRole("textbox", { name: english.Ui.Event.HostBar.messageGuests }), {
    target: { value: "Host-authored text" },
  });
}
function send() {
  fireEvent.click(screen.getByRole("button", { name: english.Ui.Event.HostBar.sendMessage }));
}
describe("#789 manual blast feedback", () => {
  it("combines channel outcomes without claiming that an event update was posted", async () => {
    open();
    fireEvent.click(screen.getByRole("checkbox", { name: "SMS" }));
    send();
    expect(
      await screen.findByText("Notifications: 1 accepted, 1 skipped, 0 failed, 0 uncertain.")
    ).toBeVisible();
    expect(screen.queryByText(/Update posted/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(
      screen.getByRole("textbox", { name: english.Ui.Event.HostBar.messageGuests })
    ).toHaveValue("");
    expect(m.sms).toHaveBeenCalledWith("event", "Host-authored text", ["ALL"], null);
  });
  it("distinguishes opted-out contacts from missing addresses and retains an unsent draft", async () => {
    m.email.mockResolvedValue(result({ accepted: 0, skipped: 2, failed: 0, uncertain: 0 }));
    open();
    send();
    expect(
      await screen.findByText("Notifications: 0 accepted, 2 skipped, 0 failed, 0 uncertain.")
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: english.Ui.Event.HostBar.messageGuests })
    ).toHaveValue("Host-authored text");
    expect(screen.queryByText(/No guests with email addresses/)).not.toBeInTheDocument();
  });
  it("reports uncertainty and warns about duplicate submissions", async () => {
    m.email.mockResolvedValue(result({ accepted: 0, skipped: 0, failed: 0, uncertain: 1 }));
    open();
    send();
    expect(
      await screen.findByText("Notifications: 0 accepted, 0 skipped, 0 failed, 1 uncertain.")
    ).toBeVisible();
    expect(
      screen.getByText(english.Ui.Event.NotificationDeliveryFeedback.uncertainHint)
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: english.Ui.Event.HostBar.messageGuests })
    ).toHaveValue("");
  });
  it.each(["throw", "partial"])(
    "preserves earlier counts after a %s processing failure",
    async (failure) => {
      if (failure === "throw") m.sms.mockRejectedValue(new Error("private-provider-secret"));
      else
        m.sms.mockResolvedValue(
          result({ accepted: 2, skipped: 0, failed: 1, uncertain: 0 }, false)
        );
      open();
      fireEvent.click(screen.getByRole("checkbox", { name: "SMS" }));
      send();
      const expected =
        failure === "throw"
          ? "Notifications: 1 accepted, 0 skipped, 0 failed, 0 uncertain."
          : "Notifications: 3 accepted, 0 skipped, 1 failed, 0 uncertain.";
      expect(await screen.findByText(expected)).toBeVisible();
      expect(await screen.findByText(english.Ui.Event.HostBar.blastProcessingFailed)).toBeVisible();
      expect(screen.queryByText("private-provider-secret")).not.toBeInTheDocument();
    }
  );
  it.each([english, dutch, german, spanish])(
    "ships explicit preference and blast feedback copy in each catalog",
    (catalog) => {
      expect(catalog.Ui.Event.NotificationDeliveryFeedback.blastSummary).toContain("{accepted}");
      expect(catalog.Ui.Event.NotificationDeliveryFeedback.blastSummary).toContain("{skipped}");
      expect(catalog.Ui.Event.NotificationDeliveryFeedback.blastSummary).toContain("{failed}");
      expect(catalog.Ui.Event.NotificationDeliveryFeedback.blastSummary).toContain("{uncertain}");
      expect(catalog.Ui.Event.HostBar.blastProcessingFailed.trim()).not.toBe("");
      expect(catalog.Ui.Notifications.updatesHint.trim()).not.toBe("");
    }
  );
});
