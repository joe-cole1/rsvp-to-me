// @vitest-environment jsdom
// Root cause (01a1a105 screenshot QA): the public guest route used translucent
// app cards and white text without the shared dark surface, making controls unreadable.
import "@/tests/helpers/english-request-locale";
import { expect, it, vi } from "vitest";
import { render, screen } from "@/tests/components/render";
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));
vi.mock("@/lib/notifications/manage", async () => {
  const { managementFixture } = await import("@/tests/helpers/notification-management");
  return { readManagement: async () => managementFixture() };
});
vi.mock("@/app/actions/notifications", () => ({
  getNotificationManagement: vi.fn(),
  saveNotificationPreferences: vi.fn(),
  beginNotificationProof: vi.fn(),
  completeNotificationProof: vi.fn(),
  removeNotificationConnection: vi.fn(),
  bindNotificationConnection: vi.fn(),
}));
vi.mock("@/components/ui/CaptchaProvider", () => ({ useCaptcha: () => ({}) }));
import NotificationPage from "@/app/e/[slug]/notifications/page";
function luminance(rgb: number[]) {
  const values = rgb
    .map((value) => value / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
it("keeps the guest preference surface readable against its actual ancestor backgrounds", async () => {
  render(
    await NotificationPage({
      params: Promise.resolve({ slug: "fixture" }),
      searchParams: Promise.resolve({ token: "fixture-token" }),
    })
  );
  // Measure the real editor heading against every ancestor surface it is painted on.
  const section = screen.getByRole("heading", { name: "Notifications for Fixture event" });
  const ancestors: Element[] = [];
  for (let node: Element | null = section; node; node = node.parentElement) ancestors.unshift(node);
  let background = [255, 255, 255];
  for (const node of ancestors) {
    // White text must contrast against the lightest stop of an opaque gradient.
    const stops = [
      ...getComputedStyle(node).backgroundImage.matchAll(/#[a-f0-9]{6}|rgba?\([^)]*\)/gi),
    ].map(([value]) =>
      value.startsWith("#")
        ? [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16))
        : value
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
    );
    if (stops.length) background = stops.sort((a, b) => luminance(b) - luminance(a))[0];
    const color = getComputedStyle(node)
      .backgroundColor.match(/[\d.]+/g)
      ?.map(Number);
    if (!color || color.length < 3) continue;
    const alpha = color[3] ?? 1;
    background = background.map((base, index) => base * (1 - alpha) + color[index] * alpha);
  }
  const foreground = getComputedStyle(section)
    .color.match(/[\d.]+/g)!
    .map(Number);
  const contrast =
    (Math.max(luminance(foreground), luminance(background)) + 0.05) /
    (Math.min(luminance(foreground), luminance(background)) + 0.05);
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});
