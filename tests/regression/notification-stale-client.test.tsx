// @vitest-environment jsdom
// Root cause (01a1a105 manual QC, riley.alerts@example.test): verifying an address on a page
// loaded before the preview server was rebuilt said "Could not save. Reload and try again."
// and the server logged nothing. The old page called server actions the new build no longer
// had; the client turned that into the generic message, and the server action wrapper
// swallowed every unexpected error without a trace. The client now says the page is out of
// date and offers a reload, and the server logs the kind of any unexpected failure (never its
// message, which can carry an address).
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/tests/components/render";
import { profileFixture } from "@/tests/helpers/notification-management";
const m = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  begin: vi.fn(),
  staleError: new Error("classified stale action fixture"),
}));
// Unit-test the public classifier boundary, not a private Next constructor's
// location or message. Production builds and browser tests use the real API.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  unstable_isUnrecognizedActionError: vi.fn((error: unknown) => error === m.staleError),
}));
vi.mock("@/app/actions/notifications", () => ({
  getNotificationManagement: m.get,
  saveNotificationPreferences: m.save,
  beginNotificationProof: m.begin,
  completeNotificationProof: vi.fn(),
  removeNotificationConnection: vi.fn(),
  bindNotificationConnection: vi.fn(),
}));
vi.mock("@/components/ui/CaptchaProvider", () => ({
  useCaptcha: () => ({
    runWithCaptcha: async (_action: string, operation: (token: string) => Promise<unknown>) =>
      operation("fixture-captcha"),
  }),
}));
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";

const stale = () => m.staleError;
beforeEach(() => {
  vi.clearAllMocks();
  m.get.mockResolvedValue({ success: true, data: profileFixture() });
});

describe("a page from an older build", () => {
  it("says to reload when adding an address hits a missing server action", async () => {
    m.begin.mockRejectedValue(stale());
    render(<NotificationPreferences scope={{ kind: "profile" }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "riley.alerts@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText(/This page is out of date. Reload to continue./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(screen.queryByText("Could not save. Reload and try again.")).toBeNull();
  });
  it("says to reload when a table change hits a missing server action", async () => {
    m.save.mockRejectedValue(stale());
    render(<NotificationPreferences scope={{ kind: "profile" }} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Event updates: Email" }));
    expect(await screen.findByText(/This page is out of date/)).toBeTruthy();
    await waitFor(() =>
      expect(
        (screen.getByRole("checkbox", { name: "Event updates: Email" }) as HTMLInputElement).checked
      ).toBe(true)
    );
  });
  it("keeps the generic message for other failures", async () => {
    m.save.mockRejectedValue(new Error("network"));
    render(<NotificationPreferences scope={{ kind: "profile" }} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Event updates: Email" }));
    expect(await screen.findByText("Could not save. Reload and try again.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
  });
  it("does not infer a stale client from dependency error prose", async () => {
    m.save.mockRejectedValue(new Error('Server Action "abc" was not found on the server.'));
    render(<NotificationPreferences scope={{ kind: "profile" }} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Event updates: Email" }));
    expect(await screen.findByText("Could not save. Reload and try again.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
  });
});
