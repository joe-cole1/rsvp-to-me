// Root cause: event validation and RSVP failures used fixed English copy regardless of the selected request language.
import { describe, it, expect, vi, beforeEach } from "vitest";
const { findEvent, rateLimit } = vi.hoisted(() => ({ findEvent: vi.fn(), rateLimit: vi.fn() }));
vi.mock("@/i18n/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/server")>();
  return { ...actual, getRequestTranslator: async () => actual.getTranslator("nl-NL") };
});
vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: findEvent },
    user: { upsert: vi.fn().mockResolvedValue({ id: "guest", preferredLocale: null }) },
    rSVP: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(1) },
  },
}));
vi.mock("@/lib/rateLimit", () => ({ rateLimit }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: async () => "127.0.0.1" }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: async () => {} }));
vi.mock("@/lib/capacityLock", () => ({
  withEventCapacityLock: async (_id: string, fn: () => Promise<unknown>) => fn(),
}));
import { addRSVP, verifyEventPassword } from "@/app/actions/event/rsvp";
const input = {
  eventId: "event1",
  guestName: "Alice",
  guestEmail: "alice@example.com",
  status: "GOING",
  plusOneCount: 0,
};
beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ success: true });
});
describe("event action request language", () => {
  it("returns translated field validation with the same result shape", async () => {
    expect(await addRSVP({ ...input, guestEmail: "bad" })).toEqual({
      success: false,
      error: "Vul een geldig e-mailadres in.",
    });
    expect(findEvent).not.toHaveBeenCalled();
  });
  it("translates throttling without exposing a different failure contract", async () => {
    rateLimit.mockResolvedValue({ success: false });
    expect(await verifyEventPassword("private", "bad")).toEqual({
      success: false,
      error: "Te veel pogingen. Probeer het later opnieuw.",
    });
  });
  it("translates the deadline failure in the browser/request language", async () => {
    findEvent.mockResolvedValue({
      status: "PUBLISHED",
      visibility: "PUBLIC",
      passwordHash: null,
      hostId: "host",
      coHosts: [],
      startAt: new Date(Date.now() + 86400000),
      rsvpDeadline: new Date(Date.now() - 1000),
    });
    expect(await addRSVP(input)).toEqual({
      success: false,
      error: "De aanmelddeadline is verstreken",
    });
  });
  it("translates capacity failure without creating an RSVP", async () => {
    findEvent.mockResolvedValue({
      status: "PUBLISHED",
      visibility: "PUBLIC",
      passwordHash: null,
      hostId: "host",
      coHosts: [],
      startAt: new Date(Date.now() + 86400000),
      rsvpDeadline: null,
      capacity: 1,
    });
    expect(await addRSVP(input)).toEqual({ success: false, error: "Het evenement is vol" });
  });
});

vi.mock("@/lib/session-user", () => ({ getSessionUser: async () => null }));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
