// #847 root cause: absent TRUSTED_IP_HEADER mapped every visitor to loopback.
// IP quotas then blocked unrelated people; destination/owner quotas must survive
// skipping those tiers. Event passwords retain a deliberate per-event cap.
import "@/tests/helpers/english-request-locale";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "@/lib/hash";

const m = vi.hoisted(() => ({
  rate: vi.fn(),
  event: vi.fn(),
  rsvp: vi.fn(),
  register: vi.fn(),
  account: vi.fn(),
  headers: vi.fn(),
  recent: vi.fn(),
  email: vi.fn(),
}));
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.rate }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(m.headers()),
  cookies: async () => ({ get: vi.fn(), set: vi.fn() }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: m.event },
    rSVP: { findUnique: m.rsvp },
    user: { findUniqueOrThrow: m.account },
    notificationChallenge: { findFirst: m.recent },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: async () => ({ userId: "host", role: "HOST" }) }));
vi.mock("@/lib/session-user", () => ({ getSessionUser: async () => ({ id: "owner" }) }));
vi.mock("@/lib/auth", () => ({
  registerHost: m.register,
  isOpenRegistrationActive: async () => true,
}));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: async () => {} }));
vi.mock("@/lib/email", () => ({ sendMagicLinkEmail: m.email }));
vi.mock("@/lib/sms", () => ({ sendMagicLinkSms: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({}));

import { registerHostAction } from "@/app/actions/auth";
import { addRSVP, verifyEventPassword } from "@/app/actions/event/rsvp";
import { sendGuestInvitations, inviteFriendAsGuest } from "@/app/actions/event/invites";
import { requestDestinationProof } from "@/lib/notifications/manage";

const input = {
  eventId: "event",
  guestName: "Guest",
  guestEmail: "guest@example.com",
  status: "GOING",
};
const keys = () => m.rate.mock.calls.map(([key]) => key as string);
const proxy = () => {
  vi.stubEnv("TRUSTED_IP_HEADER", "X-Forwarded-For");
  m.headers.mockReturnValue({ "X-Forwarded-For": "spoofed, 203.0.113.7" });
};
const counter = () => {
  const counts = new Map<string, number>();
  m.rate.mockImplementation(async (key: string, limit: number) => {
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return { success: count <= limit };
  });
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TRUSTED_IP_HEADER", "");
  m.headers.mockReturnValue({ "X-Forwarded-For": "203.0.113.7" });
  m.rate.mockResolvedValue({ success: true });
  m.event.mockResolvedValue(null);
  m.register.mockResolvedValue({ success: true });
  m.account.mockResolvedValue({ id: "owner" });
  m.recent.mockResolvedValue({ id: "recent" }); // Stop after the actual limiter boundary.
});
afterEach(() => vi.unstubAllEnvs());

describe("#847: registration and RSVP limits", () => {
  it("lets more than three distinct normalized registration addresses proceed without an IP bucket", async () => {
    counter();
    for (let i = 0; i < 5; i++) {
      expect((await registerHostAction(`USER${i}@example.com`, "Guest", "")).success).toBe(true);
    }
    expect(keys()).toHaveLength(5);
    expect(keys().every((key) => key.startsWith("id:") && key.endsWith(":register"))).toBe(true);
    expect(m.headers).not.toHaveBeenCalled();
  });
  it("still bounds repeated registration for the same normalized destination", async () => {
    counter();
    for (let i = 0; i < 3; i++) await registerHostAction("User@example.com", "Guest", "");
    expect((await registerHostAction(" user@EXAMPLE.COM ", "Guest", "")).success).toBe(false);
    expect(m.register).toHaveBeenCalledTimes(3);
    expect(keys().at(-1)).toBe(`id:${hashToken("user@example.com")}:register`);
  });
  it("enforces the trusted registration IP bucket before registration", async () => {
    proxy();
    counter();
    for (let i = 0; i < 3; i++) await registerHostAction(`user${i}@example.com`, "Guest", "");
    expect((await registerHostAction("fourth@example.com", "Guest", "")).success).toBe(false);
    expect(m.register).toHaveBeenCalledTimes(3);
    expect(keys().at(-1)).toBe("ip:203.0.113.7:register");
  });
  it("lets ten distinct guests reach the same event without a shared eight-RSVP bucket", async () => {
    counter();
    for (let i = 0; i < 10; i++) await addRSVP({ ...input, guestEmail: `guest${i}@example.com` });
    expect(m.event).toHaveBeenCalledTimes(10);
    expect(keys()).toHaveLength(20);
    expect(
      keys().every((key) => key.startsWith("rsvp:contact:") || key.startsWith("rsvp:evt-contact:"))
    ).toBe(true);
    expect(m.headers).not.toHaveBeenCalled();
  });
  it("bounds a repeated contact per event before lookup or delivery", async () => {
    counter();
    for (let i = 0; i < 8; i++) await addRSVP(input);
    m.event.mockClear();
    const result = await addRSVP({ ...input, guestEmail: " GUEST@EXAMPLE.COM " });
    expect(result.error).toMatch(/too many rsvps for this event/i);
    expect(m.event).not.toHaveBeenCalled();
  });
  it("bounds a repeated contact across events", async () => {
    counter();
    for (let i = 0; i < 15; i++) await addRSVP({ ...input, eventId: `event-${i}` });
    expect((await addRSVP({ ...input, eventId: "another" })).error).toMatch(/too many rsvps/i);
    expect(m.event).toHaveBeenCalledTimes(15);
  });
  it("normalizes phones and limits both destinations when supplied together", async () => {
    await addRSVP({ ...input, guestPhone: "+1 (555) 123-4567" });
    expect(keys()).toEqual([
      `rsvp:contact:${hashToken("email:guest@example.com")}`,
      `rsvp:evt-contact:event:${hashToken("email:guest@example.com")}`,
      `rsvp:contact:${hashToken("phone:+15551234567")}`,
      `rsvp:evt-contact:event:${hashToken("phone:+15551234567")}`,
    ]);
  });
  it("keeps contactless RSVPs available without making up a shared identity", async () => {
    await addRSVP({ eventId: "event", guestName: "Guest", status: "GOING" });
    expect(m.rate).not.toHaveBeenCalled();
    expect(m.event).toHaveBeenCalledOnce();
  });
  it("retains both trusted IP RSVP tiers", async () => {
    proxy();
    await addRSVP(input);
    expect(m.rate).toHaveBeenNthCalledWith(1, "rsvp:ip:203.0.113.7", 15, 600);
    expect(m.rate).toHaveBeenNthCalledWith(2, "rsvp:evt:event:203.0.113.7", 8, 600);
  });
});

describe("#847: invitations, password attempts and destination proofs", () => {
  it.each([false, true])("preserves host+event limits (trusted proxy: %s)", async (trusted) => {
    if (trusted) proxy();
    m.event.mockResolvedValue({ hostId: "host", slug: "party", coHosts: [] });
    m.rate.mockImplementation(async (key: string) => ({
      success: key.startsWith("host-invite:ip:"),
    }));
    await expect(
      sendGuestInvitations("event", [
        { contact: "guest@example.com", expectedDisposition: "new", expectedGuestName: "Guest" },
      ])
    ).rejects.toThrow(/too many invites sent for this event/i);
    expect(keys()).toEqual([
      ...(trusted ? ["host-invite:ip:203.0.113.7"] : []),
      "host-invite:host:event",
    ]);
  });
  it.each(["token", "rsvp"])("preserves guest %s limits without a trusted proxy", async (deny) => {
    m.rsvp.mockResolvedValue({
      id: "guest",
      eventId: "event",
      status: "GOING",
      event: { visibility: "PRIVATE", guestsCanInvite: true },
    });
    m.rate.mockImplementation(async (key: string) => ({
      success: !key.startsWith(`guest-invite:${deny}:`),
    }));
    expect((await inviteFriendAsGuest("event", "token", "guest@example.com")).success).toBe(false);
    expect(keys()).toEqual([
      "guest-invite:token:token",
      ...(deny === "rsvp" ? ["guest-invite:rsvp:guest"] : []),
    ]);
    expect(m.headers).not.toHaveBeenCalled();
  });
  it("retains the trusted guest-invite IP limit before token lookup", async () => {
    proxy();
    m.rate.mockResolvedValue({ success: false });
    expect((await inviteFriendAsGuest("event", "token", "guest@example.com")).success).toBe(false);
    expect(keys()).toEqual(["guest-invite:ip:203.0.113.7"]);
    expect(m.rsvp).not.toHaveBeenCalled();
  });
  it.each([false, true])("uses the explicit password cap (trusted proxy: %s)", async (trusted) => {
    if (trusted) proxy();
    m.rate.mockResolvedValue({ success: false });
    expect((await verifyEventPassword("party", "guess")).success).toBe(false);
    expect(m.rate).toHaveBeenCalledWith(
      `event-pw:party:${trusted ? "203.0.113.7" : "shared"}`,
      10,
      600
    );
    expect(m.event).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "keeps owner and destination proof caps (trusted proxy: %s)",
    async (trusted) => {
      if (trusted) proxy();
      await expect(
        requestDestinationProof(
          { kind: "profile" },
          { channel: "email", destination: "NEW@EXAMPLE.COM" }
        )
      ).rejects.toThrow("rateLimited");
      expect(keys()).toEqual([
        "notification-proof:owner:profile:owner",
        `notification-proof:destination:${hashToken("new@example.com")}`,
        ...(trusted ? ["notification-proof:ip:203.0.113.7"] : []),
      ]);
    }
  );
});
