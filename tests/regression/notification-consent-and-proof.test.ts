// Regression (01a1a105 QC): consent changes were tied to destination proof.
//
// Found: 2026-11-05 local QC. Reproduced in the browser:
// 1. Turning a category from Off back to On demanded a verification code for every
//    selected channel (including SMS, which the site did not offer), while "Inherit" did
//    the same thing with no code.
// 2. "Disconnect and block" on a guest's verified email, then unblocking, saved and showed
//    "Email → SMS" for every category, yet nothing could be sent: the revoked binding
//    silently paused the contact.
// 3. Disconnecting, or changing the sign-in email, hard-blocked the whole channel for every
//    event, contradicting "existing event contacts remain intact".
// Consent changes now need no proof, removing a verified address never blocks, and the
// management view reports a paused contact using the producers' own resolution.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  stored: vi.fn(),
  upsert: vi.fn(),
  bindings: vi.fn(),
  connectionFind: vi.fn(),
  connectionUnique: vi.fn(),
  connectionUpdate: vi.fn(),
  settingsUpdate: vi.fn(),
  userUpdate: vi.fn(),
}));
const account = {
  id: "user",
  email: "account@example.com",
  phone: null,
  notificationChannel: "BOTH",
  emailNotifications: true,
  smsNotifications: true,
  preferredLocale: "en-US",
};
const rsvp = {
  id: "rsvp",
  eventId: "event",
  userId: null,
  guestEmail: "guest@example.com",
  guestPhone: null,
  user: null,
  event: { id: "event", title: "Party" },
};
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUniqueOrThrow: async () => account, update: m.userUpdate },
    rSVP: { findFirst: async () => rsvp, findUnique: async () => rsvp },
    notificationSettings: {
      findUnique: m.stored,
      findMany: async () => [],
      upsert: m.upsert,
      update: m.settingsUpdate,
    },
    notificationCategoryPreference: { deleteMany: vi.fn(), createMany: vi.fn() },
    notificationConnection: {
      findMany: async () => [],
      findFirst: m.connectionFind,
      findUnique: m.connectionUnique,
      update: m.connectionUpdate,
    },
    notificationBinding: { findMany: m.bindings, updateMany: vi.fn() },
    notificationChallenge: { updateMany: vi.fn() },
    $executeRaw: vi.fn(),
    async $transaction<T>(action: (tx: unknown) => Promise<T>) {
      return action(this);
    },
  },
}));
vi.mock("@/lib/session-user", () => ({ getSessionUser: m.session }));
vi.mock("@/lib/notifications/service", async (original) => ({
  ...(await original<typeof import("@/lib/notifications/service")>()),
  offeredChannels: async () => ["email", "sms"],
}));
import { readManagement, removeConnection, saveManagement } from "@/lib/notifications/manage";
import { retireChangedAccountConnection } from "@/lib/notifications/lifecycle";

const categories = (remindersOn: boolean) =>
  (["updates", "reminders", "confirmations", "host_alerts"] as const).map((category) => ({
    category,
    channels: category !== "reminders" || remindersOn ? ["email" as const, "sms" as const] : [],
  }));
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ id: "user" });
  m.bindings.mockResolvedValue([]);
});

describe("consent is not destination proof", () => {
  it("turns a category back on without asking for a code", async () => {
    m.stored.mockResolvedValue({
      revision: 2,
      channels: ["email", "sms"],
      blockedChannels: [],
      categories: categories(false),
    });
    await saveManagement({ kind: "profile" }, { revision: 2, categories: categories(true) });
    expect(m.upsert).toHaveBeenCalled();
    expect(m.connectionUnique).not.toHaveBeenCalled();
  });
  it("removing a verified address never blocks the channel", async () => {
    m.connectionUnique.mockResolvedValue({ id: "connection", revokedAt: null });
    await removeConnection({ kind: "profile" }, "email");
    expect(m.connectionUpdate).toHaveBeenCalled();
    expect(m.upsert).not.toHaveBeenCalled();
    expect(m.userUpdate).not.toHaveBeenCalled();
  });
  it("a sign-in contact change retires proof without blocking the channel", async () => {
    m.connectionFind.mockResolvedValue({ id: "connection" });
    await retireChangedAccountConnection("user", "email", "old@example.com");
    expect(m.connectionUpdate).toHaveBeenCalled();
    expect(m.settingsUpdate).not.toHaveBeenCalled();
  });
  it("reports a contact whose proof was revoked as paused, so the page cannot claim it", async () => {
    m.session.mockResolvedValue(null);
    m.stored.mockResolvedValue(null);
    m.bindings.mockResolvedValue([
      {
        rsvpId: "rsvp",
        channel: "email",
        destination: "guest@example.com",
        revokedAt: new Date(),
        connectionId: null,
        connectionGeneration: null,
        connection: null,
      },
    ]);
    const data = await readManagement({ kind: "rsvp", slug: "party", token: "private" });
    expect(data.contacts).toEqual([
      { channel: "email", destination: "g•••t@example.com", state: "paused" },
      { channel: "sms", destination: null, state: "missing" },
    ]);
    // Consent stays checked; the contact list is what tells the guest nothing can be sent.
    expect(data.rows.find((row) => row.category === "updates")!.channels).toEqual(["email", "sms"]);
  });
});
