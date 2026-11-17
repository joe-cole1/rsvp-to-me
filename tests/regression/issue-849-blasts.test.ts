// #849 root cause: unbounded manual blasts bypassed rate limits and appended
// unlinked Invitation rows, confusing the host's Invited tab with message history.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  limit: vi.fn(),
  email: vi.fn(),
  sms: vi.fn(),
  invites: vi.fn(),
  guests: vi.fn(),
  guard: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: async () => ({ title: "Party", slug: "party", host: { name: "Host" } }) },
    rSVP: { findMany: m.guests },
    notificationSettings: { findMany: async () => [] },
    notificationConnection: { findMany: async () => [] },
    notificationBinding: { findMany: async () => [] },
    invitation: { createMany: m.invites },
  },
}));
vi.mock("@/app/actions/event/shared", () => ({ assertHostOrCohost: m.guard }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.limit }));
vi.mock("@/lib/email", () => ({
  createEmailNotificationAdapter: async () => ({
    channel: "email",
    available: true,
    kinds: ["event_update"],
    deliver: m.email,
  }),
}));
vi.mock("@/lib/sms", () => ({
  createSmsNotificationAdapter: async () => ({
    channel: "sms",
    available: true,
    kinds: ["event_update"],
    deliver: m.sms,
  }),
}));
import { sendBlast, sendSmsBlast } from "@/app/actions/event/blasts";
beforeEach(() => {
  vi.clearAllMocks();
  m.guard.mockResolvedValue({});
  m.limit.mockResolvedValue({ success: true });
  m.guests.mockResolvedValue([
    {
      id: "guest",
      userId: null,
      user: null,
      guestEmail: "guest@example.test",
      guestPhone: "+15551234567",
    },
  ]);
  m.email.mockResolvedValue([{ status: "accepted" }]);
  m.sms.mockResolvedValue([{ status: "accepted" }]);
});
for (const [channel, send] of [
  ["email", sendBlast],
  ["sms", sendSmsBlast],
] as const)
  describe(`#849 ${channel} blasts`, () => {
    it.each(["", "   ", "x".repeat(10001)])(
      "rejects an invalid message before querying recipients",
      async (message) => {
        await expect(send("event", message, ["ALL"])).rejects.toThrow("1 to 10,000");
        expect(m.guests).not.toHaveBeenCalled();
        expect(m.limit).not.toHaveBeenCalled();
      }
    );
    it("shares the per-event channel quota between organizers", async () => {
      m.limit.mockResolvedValue({ success: false });
      await expect(send("event", "Hello", ["ALL"])).rejects.toThrow("Too many messages");
      expect(m.limit).toHaveBeenCalledWith(`blast:event:${channel}`, 10, 3600);
      expect(m.guests).not.toHaveBeenCalled();
    });
    it("accepts the maximum message without creating invitations", async () => {
      await expect(send("event", "x".repeat(10000), ["ALL"])).resolves.toEqual({
        success: true,
        sent: 1,
        summary: { accepted: 1, skipped: 0, failed: 0, uncertain: 0 },
      });
      expect(m.invites).not.toHaveBeenCalled();
    });
    it("checks host authority before using the quota", async () => {
      m.guard.mockRejectedValue(new Error("Forbidden"));
      await expect(send("event", "Hello", ["ALL"])).rejects.toThrow("Forbidden");
      expect(m.limit).not.toHaveBeenCalled();
    });
  });
