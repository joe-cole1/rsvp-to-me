// Root cause: verifying a new profile contact rewrote every linked RSVP contact,
// silently redirecting event messages and private RSVP links to another destination.
import "@/tests/helpers/english-request-locale";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  token: vi.fn(),
  user: vi.fn(),
  update: vi.fn(),
  rsvps: vi.fn(),
  retire: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    magicToken: { findUnique: m.token, update: vi.fn() },
    user: { findUnique: m.user, findFirst: async () => null, update: m.update },
    rSVP: { updateMany: m.rsvps },
  },
}));
vi.mock("@/lib/notifications/lifecycle", () => ({ retireChangedAccountConnection: m.retire }));
vi.mock("@/lib/session", () => ({ createSession: vi.fn() }));
import { verifyChangeToken } from "@/lib/auth";
beforeEach(() => {
  vi.clearAllMocks();
  m.retire.mockResolvedValue(undefined);
  m.user.mockResolvedValue({
    id: "user",
    email: "old@example.com",
    phone: "+15550001111",
    role: "GUEST",
  });
});
it.each(["EMAIL_CHANGE", "PHONE_CHANGE"])(
  "keeps event contacts intact when %s is verified",
  async (type) => {
    m.token.mockResolvedValue({
      id: "token",
      userId: "user",
      type,
      metadata: type === "EMAIL_CHANGE" ? "new@example.com" : "+15559999999",
      used: false,
      expiresAt: new Date(Date.now() + 60000),
    });
    expect((await verifyChangeToken("private-proof")).success).toBe(true);
    for (const [query] of m.rsvps.mock.calls) {
      expect(query.data).not.toHaveProperty("guestEmail");
      expect(query.data).not.toHaveProperty("guestPhone");
    }
    expect(m.retire).toHaveBeenCalledWith(
      "user",
      type === "EMAIL_CHANGE" ? "email" : "sms",
      type === "EMAIL_CHANGE" ? "old@example.com" : "+15550001111"
    );
  }
);
