// Regression (01a1a105 QC): host RSVP alerts silently stopped for organizers.
//
// Found: 2026-11-05 local QC of the recipient-preferences milestone.
// Root causes:
// 1. The first organizer write (saving defaults, binding or disconnecting) created a
//    personal row with no eligibility. Its stored row replaced the event switches, so the
//    account email needed a matching verified connection and alerts stopped while the page
//    still said "Email". Reproduced end to end: RSVP #1 alerted, Save, RSVP #2 did not.
// 2. The migration wrote `mode='preferred', channels='{}'` for events whose alert switches
//    were both off, so turning alerts on later sent nothing to existing organizers.
// 3. Any revoked connection for a channel dropped the organizer's account contact too.
// Organizers now inherit their profile route, eligibility comes from the event switches
// (snapshotted on first write and at migration), and only bindings depend on connections.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  event: vi.fn(),
  settings: vi.fn(),
  connections: vi.fn(),
  bindings: vi.fn(),
  session: vi.fn(),
  upsert: vi.fn(),
  account: vi.fn(),
  organizer: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: m.event, findFirst: m.organizer },
    user: { findUniqueOrThrow: m.account, update: vi.fn() },
    notificationSettings: { findMany: m.settings, findUnique: async () => null, upsert: m.upsert },
    notificationCategoryPreference: { deleteMany: vi.fn(), createMany: vi.fn() },
    notificationConnection: { findMany: m.connections },
    notificationBinding: { findMany: m.bindings },
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
import { resolveHostRecipients } from "@/lib/notifications/service";
import { saveManagement } from "@/lib/notifications/manage";

const host = {
  id: "host",
  email: "host@example.com",
  phone: "+15550002222",
  preferredLocale: "en-US",
  notificationChannel: "BOTH",
  emailNotifications: true,
  smsNotifications: true,
};
const event = (switches: { hostAlertEmail: boolean; hostAlertSms: boolean }) => ({
  id: "event",
  status: "PUBLISHED",
  host,
  coHosts: [],
  ...switches,
});
beforeEach(() => {
  vi.clearAllMocks();
  m.event.mockResolvedValue(event({ hostAlertEmail: true, hostAlertSms: false }));
  m.settings.mockResolvedValue([]);
  m.connections.mockResolvedValue([]);
  m.bindings.mockResolvedValue([]);
  m.session.mockResolvedValue({ id: "host" });
  m.account.mockResolvedValue(host);
  m.organizer.mockResolvedValue({
    id: "event",
    title: "Party",
    hostAlertEmail: true,
    hostAlertSms: false,
  });
});

describe("organizer alert eligibility", () => {
  it("snapshots the event's eligibility when an organizer first saves", async () => {
    await saveManagement({ kind: "organizer", eventId: "event" }, { revision: 0, categories: [] });
    expect(m.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ legacyChannels: ["email"] }) })
    );
  });
  it("keeps alerting the account email after that first save", async () => {
    m.settings.mockResolvedValue([
      {
        id: "organizer:event:host",
        channels: [],
        blockedChannels: [],
        categories: [],
        legacyChannels: ["email"],
      },
    ]);
    const [recipient] = await resolveHostRecipients("event", false);
    expect(recipient.destinations).toEqual({ email: "host@example.com" });
    expect(recipient.policy.channels).toEqual(["email", "sms"]);
  });
  it("follows the current switches when no row exists, so alerts can be turned back on", async () => {
    m.event.mockResolvedValue(event({ hostAlertEmail: false, hostAlertSms: false }));
    expect(await resolveHostRecipients("event", false)).toEqual([]);
    m.event.mockResolvedValue(event({ hostAlertEmail: true, hostAlertSms: false }));
    expect((await resolveHostRecipients("event", false))[0].destinations).toEqual({
      email: "host@example.com",
    });
  });
  it("keeps an SMS-only event's snapshot without vouching for the account email", async () => {
    m.settings.mockResolvedValue([
      {
        id: "organizer:event:host",
        channels: [],
        blockedChannels: [],
        categories: [],
        legacyChannels: ["sms"],
      },
    ]);
    expect((await resolveHostRecipients("event", false))[0].destinations).toEqual({
      sms: "+15550002222",
    });
  });
  it("does not drop the account contact because some connection for the channel was revoked", async () => {
    // A removed address used to skip the whole channel, including the account contact.
    m.connections.mockResolvedValue([
      { userId: "host", channel: "email", destination: "old@example.com", revokedAt: new Date() },
    ]);
    expect((await resolveHostRecipients("event", false))[0].destinations.email).toBe(
      "host@example.com"
    );
    expect(m.connections).toHaveBeenCalledWith({
      where: { userId: { in: ["host"] }, revokedAt: null },
    });
  });
  it("pauses a bound address whose connection was revoked instead of using it", async () => {
    m.bindings.mockResolvedValue([
      {
        settingsId: "organizer:event:host",
        channel: "email",
        destination: "alerts@example.com",
        revokedAt: new Date(),
        connectionId: "connection",
        connectionGeneration: 1,
        connection: { revokedAt: new Date(), generation: 2 },
      },
    ]);
    const [recipient] = await resolveHostRecipients("event", false);
    expect(recipient.destinations.email).toBeUndefined();
  });
});
