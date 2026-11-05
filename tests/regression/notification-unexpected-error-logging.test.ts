// Root cause (01a1a105 manual QC, riley.alerts@example.test): an address verification failed
// with "Could not save. Reload and try again." and the server log had nothing to diagnose
// it, because the notification action wrapper turned every unexpected error into that
// message silently. It now logs the error's kind and code, never the message, which can
// carry an address. Expected refusals (bad code, rate limits) stay quiet.
import "@/tests/helpers/english-request-locale";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/lib/notifications/manage", () => ({
  saveManagement: m.save,
  readManagement: vi.fn(),
  requestDestinationProof: vi.fn(),
  verifyDestinationProof: vi.fn(),
  removeConnection: vi.fn(),
  authorizeManagement: vi.fn(),
  assertNotificationContactAvailable: vi.fn(),
}));
vi.mock("@/lib/notifications/service", () => ({ organizerEligibility: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/session-user", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: vi.fn() }));
import { saveNotificationPreferences } from "@/app/actions/notifications";

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => log.mockRestore());

describe("notification action failures", () => {
  it("logs the kind of an unexpected failure without its message", async () => {
    const error = Object.assign(new Error("Unique constraint on riley.alerts@example.test"), {
      name: "PrismaClientKnownRequestError",
      code: "P2002",
    });
    m.save.mockRejectedValue(error);
    const result = await saveNotificationPreferences({ kind: "profile" }, {});
    expect(result).toMatchObject({ success: false, code: "saveFailed" });
    expect(log).toHaveBeenCalledWith("[notifications] Unexpected action failure", {
      name: "PrismaClientKnownRequestError",
      code: "P2002",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("riley.alerts");
  });
  it("stays quiet for expected refusals", async () => {
    m.save.mockRejectedValue(new Error("settingsChanged"));
    const result = await saveNotificationPreferences({ kind: "profile" }, {});
    expect(result).toMatchObject({ success: false, code: "settingsChanged" });
    expect(log).not.toHaveBeenCalled();
  });
});
