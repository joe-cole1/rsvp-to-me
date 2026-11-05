// @vitest-environment jsdom
// Root cause (01a1a105 screenshot QA): the guest page rendered editable server
// data while a second client read was pending, which could erase a new choice.
// The page now seeds the editor from its authorizing server read, so no later read exists.
import "@/tests/helpers/english-request-locale";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/tests/components/render";
import { managementFixture } from "@/tests/helpers/notification-management";
const m = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));
vi.mock("@/lib/notifications/manage", () => ({ readManagement: m.read }));
vi.mock("@/app/actions/notifications", () => ({
  getNotificationManagement: m.get,
  saveNotificationPreferences: m.save,
  beginNotificationProof: vi.fn(),
  completeNotificationProof: vi.fn(),
  removeNotificationConnection: vi.fn(),
  bindNotificationConnection: vi.fn(),
}));
vi.mock("@/components/ui/CaptchaProvider", () => ({ useCaptcha: () => ({}) }));
import NotificationPage from "@/app/e/[slug]/notifications/page";

it("seeds the guest editor from the server read and saves a choice immediately", async () => {
  const fixture = managementFixture();
  m.read.mockResolvedValue(fixture);
  m.save.mockResolvedValue({ success: true, data: { ...fixture, revision: 1 } });
  render(
    await NotificationPage({
      params: Promise.resolve({ slug: "fixture" }),
      searchParams: Promise.resolve({ token: "fixture-token" }),
    })
  );
  // No second read can arrive later and overwrite what the guest chooses.
  expect(m.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("switch", { name: "Use my profile settings for this event" }));
  await waitFor(() =>
    expect(m.save).toHaveBeenCalledWith(
      { kind: "rsvp", slug: "fixture", token: "fixture-token" },
      { revision: 0, categories: fixture.rows }
    )
  );
});
