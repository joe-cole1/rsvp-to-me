// Root cause: account links can be created from claimed contacts; reusable
// profile destinations and legacy flags must never grant event destination authority.
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  settings: vi.fn(),
  bindings: vi.fn(),
  connections: vi.fn(),
  rsvp: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    notificationSettings: { findMany: mocks.settings },
    notificationBinding: { findMany: mocks.bindings },
    notificationConnection: { findMany: mocks.connections },
    rSVP: { findUnique: mocks.rsvp },
  },
}));
import { resolveRecipients, type RecipientRow } from "@/lib/notifications/resolve";
import { dispatchNotification } from "@/lib/notifications/dispatch";
const row: RecipientRow = {
  id: "rsvp",
  userId: "user",
  guestEmail: "event@example.com",
  guestPhone: "+15550001111",
  user: {
    notificationChannel: "BOTH",
    emailNotifications: true,
    smsNotifications: true,
    preferredLocale: "nl-NL",
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.settings.mockResolvedValue([]);
  mocks.bindings.mockResolvedValue([]);
  mocks.connections.mockResolvedValue([]);
  mocks.rsvp.mockResolvedValue(row);
});
describe("event notification contact authority", () => {
  it("reports an opted-out recipient as skipped without submitting", async () => {
    // An empty policy previously created no job and vanished from aggregate feedback.
    mocks.settings.mockResolvedValue([
      {
        id: "profile:user",
        channels: ["email", "sms"],
        blockedChannels: [],
        categories: [{ category: "updates", channels: [] }],
      },
    ]);
    const recipients = await resolveRecipients("updates", [row]);
    const deliver = vi.fn(async () => []);
    const report = await dispatchNotification(
      {
        kind: "event_update",
        id: "update",
        eventSlug: "party",
        eventTitle: "Party",
        body: "Fixture",
        hostName: null,
      },
      recipients,
      [{ channel: "email", available: true, kinds: ["event_update"], deliver }]
    );
    expect(report.summary.skipped).toBe(1);
    expect(deliver).not.toHaveBeenCalled();
  });
  it("uses current event contacts even when a profile connection has another destination", async () => {
    mocks.connections.mockResolvedValue([
      { userId: "user", channel: "email", destination: "unrelated@example.com" },
    ]);
    const [recipient] = await resolveRecipients("updates", [row]);
    expect(recipient.destinations).toEqual({ email: "event@example.com", sms: "+15550001111" });
    expect(recipient.locale).toBe("nl-NL");
  });
  it("keeps an event-level channel opt-out after profile preferences expand", async () => {
    // Opt-outs live in preferences, so expanding the profile cannot reopen this event's SMS.
    mocks.settings.mockResolvedValue([
      {
        id: "profile:user",
        channels: ["sms", "email"],
        blockedChannels: [],
        categories: [],
      },
      {
        id: "rsvp:rsvp",
        channels: [],
        blockedChannels: ["sms"],
        categories: [],
        legacyChannels: [],
      },
    ]);
    const [recipient] = await resolveRecipients("updates", [row]);
    expect(recipient.policy.channels).toEqual(["email"]);
  });
  it("gives a separate copy only to a contact proved at that exact destination", async () => {
    mocks.connections.mockResolvedValue([
      { userId: "user", channel: "email", destination: "event@example.com" },
      { userId: "user", channel: "sms", destination: "+15559999999" },
    ]);
    const [recipient] = await resolveRecipients("updates", [row]);
    // The event's phone is still eligible, but a profile proof of another number never
    // vouches for it: it shares one message instead of getting its own copy.
    expect(recipient.destinations).toEqual({ email: "event@example.com", sms: "+15550001111" });
    expect(recipient.proved).toEqual(["email"]);
  });
  it.each([
    { revokedAt: new Date(), destination: row.guestEmail },
    { revokedAt: null, destination: "stale@example.com" },
    {
      revokedAt: null,
      destination: row.guestEmail,
      connectionId: "connection",
      connectionGeneration: 1,
      connection: { generation: 2, revokedAt: null },
    },
    {
      revokedAt: null,
      destination: row.guestEmail,
      connectionId: "connection",
      connectionGeneration: 1,
      connection: { generation: 1, revokedAt: new Date() },
    },
    { revokedAt: null, destination: row.guestEmail, connectionId: "connection", connection: null },
  ])("never resurrects a revoked/stale binding through legacy routing", async (binding) => {
    mocks.bindings.mockResolvedValue([{ ...binding, rsvpId: row.id, channel: "email" }]);
    expect((await resolveRecipients("updates", [row]))[0].destinations.email).toBeUndefined();
  });
  it("permits an explicitly verified event destination and respects migrated schedule ceilings", async () => {
    mocks.bindings.mockResolvedValue([
      { rsvpId: row.id, channel: "sms", destination: row.guestPhone, revokedAt: null },
    ]);
    // Separate copies need proof of each exact destination: only the bound SMS qualifies.
    const [copies] = await resolveRecipients("reminders", [row]);
    expect(copies.destinations).toEqual({ email: row.guestEmail, sms: row.guestPhone });
    expect(copies.proved).toEqual(["sms"]);
    // A migrated email-only ceiling leaves one channel, which is ordinary single delivery.
    const [ceiling] = await resolveRecipients("reminders", [row], ["email"]);
    expect(ceiling.policy.channels).toEqual(["email"]);
    expect(ceiling.destinations.email).toBe(row.guestEmail);
  });
  it("rechecks current contact and preferences before provider submission", async () => {
    const [recipient] = await resolveRecipients("updates", [row]);
    expect(await recipient.canSend!("email", row.guestEmail!)).toBe(true);
    mocks.rsvp.mockResolvedValue({ ...row, guestEmail: "changed@example.com" });
    expect(await recipient.canSend!("email", row.guestEmail!)).toBe(false);
    mocks.rsvp.mockResolvedValue(null);
    expect(await recipient.canSend!("email", row.guestEmail!)).toBe(false);
  });
});
