// @vitest-environment jsdom
// #849 fixture regression: acknowledging browser email makes that channel offered.
// Preserve explicit no-provider guest/profile coverage alongside email-enabled E2E.
import "@/tests/helpers/english-request-locale";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@/tests/components/render";
import { managementFixture, profileFixture } from "@/tests/helpers/notification-management";
const m = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock("@/app/actions/notifications", () => ({
  getNotificationManagement: m.get,
  saveNotificationPreferences: m.save,
  beginNotificationProof: vi.fn(),
  completeNotificationProof: vi.fn(),
  removeNotificationConnection: vi.fn(),
  bindNotificationConnection: vi.fn(),
}));
vi.mock("@/components/ui/CaptchaProvider", () => ({ useCaptcha: () => ({}) }));
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
beforeEach(() => vi.clearAllMocks());
it.each(["profile", "rsvp"] as const)(
  "hides unavailable controls and never writes the %s zero-channel state",
  async (kind) => {
    m.get.mockResolvedValue({
      success: true,
      data:
        kind === "profile"
          ? profileFixture({ offered: [] })
          : managementFixture({ offered: [], contacts: [], linked: false, own: true }),
    });
    render(
      <NotificationPreferences
        scope={kind === "profile" ? { kind } : { kind, slug: "party", token: "private" }}
      />
    );
    expect(await screen.findByText("This site doesn’t send notifications right now.")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Add$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    expect(m.save).not.toHaveBeenCalled();
  }
);
