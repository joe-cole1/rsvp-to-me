// #850 root cause: cover upload failures were only logged, so storage quota
// failures had no visible feedback. Failed avatar assignment must keep the saved image.
// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@/tests/components/render";
import { EventPage } from "@/components/event/EventPage";
import ProfileClient from "@/app/(app)/profile/ProfileClient";
import { qcEvent } from "@/tests/helpers/qc-event";
import { testTheme } from "@/tests/components/helpers/theme";
const m = vi.hoisted(() => ({ fetch: vi.fn(), cover: vi.fn(), profile: vi.fn() }));
vi.mock("@/app/actions/event", () => ({ saveCoverImage: m.cover }));
vi.mock("@/app/actions/profile", () => ({ updateProfileSettings: m.profile }));
vi.mock("@/components/event/HostBar", () => ({ HostBar: () => null }));
vi.mock("@/components/ui/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/notifications/NotificationPreferences", () => ({
  NotificationPreferences: () => null,
}));
vi.mock("@/lib/client-image", () => ({ compressImage: async (file: File) => file }));
vi.mock("@/components/ui/CaptchaProvider", () => ({
  useCaptcha: () => ({
    runWithCaptcha: async (_action: string, fn: (token: string) => Promise<unknown>) =>
      fn("captcha"),
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement("img", { src, alt }),
}));
const oldUrl = "/api/uploads/12345678-1234-4123-8123-123456789abc.png";
const newUrl = "/api/uploads/22345678-1234-4123-8123-123456789abc.png";
const profile = {
  id: "host",
  name: "Host",
  email: "host@example.test",
  phone: null,
  avatarUrl: oldUrl,
  role: "HOST" as const,
  emailNotifications: true,
  smsNotifications: false,
  notificationChannel: "EMAIL" as const,
  deletionRequestedAt: null,
  deletionScheduledAt: null,
};
function choose(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  fireEvent.change(input!, {
    target: { files: [new File(["image"], "picture.png", { type: "image/png" })] },
  });
}
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", m.fetch);
  m.fetch.mockResolvedValue({ ok: false, json: async () => ({ code: "UPLOAD_QUOTA_EXCEEDED" }) });
  m.cover.mockResolvedValue(undefined);
  m.profile.mockResolvedValue({ success: true });
});
afterEach(() => vi.unstubAllGlobals());
describe("#850 upload feedback", () => {
  it("shows a quota rejection beside the cover and keeps the existing image", async () => {
    const event = {
      ...qcEvent,
      theme: {
        baseTheme: "DARK" as const,
        gradientFrom: "#7c3aed",
        gradientTo: "#1e40af",
        accentColor: "#a855f7",
        coverImageUrl: oldUrl,
      },
    };
    const { container } = render(
      <EventPage event={event} isHost theme={testTheme} coverUploadEnabled />
    );
    choose(container);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Upload storage is full (100 MiB per account)"
    );
    expect(m.cover).not.toHaveBeenCalled();
    expect(container.querySelector(`img[src="${oldUrl}"]`)).not.toBeNull();
  });
  it("shows a useful profile quota error and keeps its avatar", async () => {
    const { container } = render(<ProfileClient initialProfile={profile} />);
    choose(container);
    await waitFor(() => expect(screen.getByText(/Upload storage is full/)).toBeVisible());
    expect(m.profile).not.toHaveBeenCalled();
    expect(container.querySelector(`img[src="${oldUrl}"]`)).not.toBeNull();
  });
  it("does not show an unsaved avatar when assignment fails", async () => {
    m.fetch.mockResolvedValue({ ok: true, json: async () => ({ url: newUrl }) });
    m.profile.mockRejectedValue(new Error("Save failed"));
    const { container } = render(<ProfileClient initialProfile={profile} />);
    choose(container);
    expect(await screen.findByText("Save failed")).toBeVisible();
    expect(container.querySelector(`img[src="${oldUrl}"]`)).not.toBeNull();
    expect(container.querySelector(`img[src="${newUrl}"]`)).toBeNull();
  });
});
