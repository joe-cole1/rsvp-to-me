import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "@/lib/hash";
const m = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    delete: vi.fn(),
  });
  return {
    session: vi.fn(),
    config: vi.fn(),
    rate: vi.fn(),
    deliver: vi.fn(),
    offered: vi.fn(),
    user: model(),
    rSVP: model(),
    event: model(),
    notificationSettings: model(),
    notificationBinding: model(),
    notificationConnection: model(),
    notificationChallenge: model(),
    notificationCategoryPreference: model(),
    lock: vi.fn(),
  };
});
vi.mock("@/lib/db", () => ({
  db: {
    ...m,
    $executeRaw: m.lock,
    async $transaction<T>(action: (tx: unknown) => Promise<T>) {
      return action(this);
    },
  },
}));
vi.mock("@/lib/session-user", () => ({ getSessionUser: m.session }));
vi.mock("@/lib/config", () => ({ getChannelConfig: m.config }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: async () => "127.0.0.1" }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.rate }));
vi.mock("@/lib/notifications/service", () => ({
  deliver: m.deliver,
  offeredChannels: () => m.offered(),
  describeOrganizerRoutes: async () => null,
  organizerEligibility: (event: { hostAlertEmail?: boolean; hostAlertSms?: boolean }) =>
    [event.hostAlertEmail && "email", event.hostAlertSms && "sms"].filter(Boolean),
}));
import {
  authorizeManagement,
  readManagement,
  saveManagement,
  requestDestinationProof,
  verifyDestinationProof,
  removeConnection,
} from "@/lib/notifications/manage";
const account = {
  id: "user",
  email: "account@example.com",
  phone: "+15550001111",
  notificationChannel: "BOTH",
  emailNotifications: true,
  smsNotifications: true,
  preferredLocale: "en-US",
};
const profile = { kind: "profile" };
const rsvpScope = { kind: "rsvp", slug: "party", token: "private-token" };
const guest = {
  id: "rsvp",
  eventId: "event",
  userId: "user",
  guestEmail: "event@example.com",
  guestPhone: null,
  user: account,
  event: { id: "event", title: "Party" },
};
const stored = () => ({
  id: "profile:user",
  channels: ["email", "sms"],
  blockedChannels: [] as string[],
  legacyChannels: [],
  categories: [] as { category: string; channels: string[] }[],
  revision: 0,
});
const ALL = ["updates", "reminders", "confirmations", "host_alerts"] as const;
/** A profile table write: every row, with the given channels unless overridden. */
const input = (
  channels: string[] = ["email", "sms"],
  overrides: Partial<Record<(typeof ALL)[number], string[]>> = {}
) => ({
  revision: 0,
  categories: ALL.map((category) => ({ category, channels: overrides[category] ?? channels })),
});
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ id: "user" });
  m.user.findUniqueOrThrow.mockResolvedValue(account);
  m.rSVP.findFirst.mockResolvedValue(guest);
  m.rSVP.findUniqueOrThrow.mockResolvedValue(guest);
  m.event.findFirst.mockResolvedValue({ id: "event", title: "Party" });
  m.notificationSettings.findUnique.mockResolvedValue(stored());
  m.notificationSettings.upsert.mockResolvedValue({});
  m.notificationSettings.findMany.mockResolvedValue([]);
  m.rSVP.findUnique.mockResolvedValue(guest);
  m.notificationBinding.findMany.mockResolvedValue([]);
  m.notificationBinding.findUnique.mockResolvedValue(null);
  m.notificationConnection.findMany.mockResolvedValue([]);
  m.notificationConnection.findUnique.mockResolvedValue(null);
  m.notificationConnection.findFirst.mockResolvedValue(null);
  m.notificationChallenge.findFirst.mockResolvedValue(null);
  m.notificationChallenge.findUnique.mockResolvedValue(null);
  m.notificationChallenge.create.mockResolvedValue({ id: "challenge" });
  m.config.mockResolvedValue({ email: true, sms: true });
  m.rate.mockResolvedValue({ success: true });
  m.deliver.mockResolvedValue({ summary: { accepted: 1, uncertain: 0 } });
  m.offered.mockResolvedValue(["email", "sms"]);
});
describe("notification management authority and serialization", () => {
  it("requires an account for profile settings", async () => {
    m.session.mockResolvedValue(null);
    await expect(authorizeManagement(profile)).rejects.toThrow("unauthorized");
  });
  it("rejects public RSVP IDs and claimed destination fields", async () => {
    m.session.mockResolvedValue(null);
    await expect(
      authorizeManagement({ kind: "rsvp", slug: "party", rsvpId: "public" })
    ).rejects.toThrow("unauthorized");
    await expect(authorizeManagement({ ...rsvpScope, username: "victim" })).rejects.toThrow();
  });
  it("requires proof beyond an automatically linked user ID", async () => {
    await expect(
      authorizeManagement({ kind: "rsvp", slug: "party", rsvpId: "rsvp" })
    ).rejects.toThrow("proofRequired");
  });
  it("accepts matching proof for account-based event management", async () => {
    m.notificationConnection.findMany.mockResolvedValue([
      { id: "connection", channel: "email", destination: "event@example.com" },
    ]);
    expect((await authorizeManagement({ kind: "rsvp", slug: "party", rsvpId: "rsvp" })).id).toBe(
      "rsvp:rsvp"
    );
  });
  it("allows an unsigned guest to manage only the token's event", async () => {
    m.session.mockResolvedValue(null);
    expect((await authorizeManagement(rsvpScope)).id).toBe("rsvp:rsvp");
    expect(m.rSVP.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editToken: "private-token",
          event: { slug: "party", status: { not: "DELETED" } },
        }),
      })
    );
    m.rSVP.findFirst.mockResolvedValue(null);
    await expect(authorizeManagement({ ...rsvpScope, slug: "foreign" })).rejects.toThrow(
      "unauthorized"
    );
  });
  it("requires personal organizer membership, not a general admin role", async () => {
    m.event.findFirst.mockResolvedValue(null);
    await expect(authorizeManagement({ kind: "organizer", eventId: "event" })).rejects.toThrow(
      "unauthorized"
    );
  });
  it("serializes only masked authorized destinations and no secrets", async () => {
    m.notificationConnection.findMany.mockResolvedValue([
      {
        id: "connection",
        channel: "email",
        destination: "private@example.com",
        generation: 1,
        verifiedAt: new Date(),
        revokedAt: null,
        secretHash: "secret",
      },
    ]);
    const data = await readManagement(profile);
    expect(data.connections[0]).toMatchObject({ destination: "p•••e@example.com", bound: false });
    expect(JSON.stringify(data)).not.toContain("private@example.com");
    expect(JSON.stringify(data)).not.toContain("secret");
  });
  it("does not expose profile connections to unsigned token holders", async () => {
    m.session.mockResolvedValue(null);
    const data = await readManagement(rsvpScope);
    expect(data.connections).toEqual([]);
    // Proof may inform the contact's state server-side, but the owner's list is never read.
    expect(m.notificationConnection.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ include: { bindings: true } })
    );
    expect(data.contacts[0]).toEqual({
      channel: "email",
      destination: "e•••t@example.com",
      state: "on_file",
    });
  });
});
describe("atomic notification preference writes", () => {
  it("saves every row and projects conservative legacy flags", async () => {
    await saveManagement(
      profile,
      input(["email", "sms"], { updates: ["email"], reminders: ["email"] })
    );
    expect(m.notificationSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ revision: 1, blockedChannels: [] }),
      })
    );
    expect(m.notificationCategoryPreference.createMany).toHaveBeenCalledWith({
      data: [
        { settingsId: "profile:user", category: "updates", channels: ["email"] },
        { settingsId: "profile:user", category: "reminders", channels: ["email"] },
        { settingsId: "profile:user", category: "confirmations", channels: ["email", "sms"] },
        { settingsId: "profile:user", category: "host_alerts", channels: ["email", "sms"] },
      ],
    });
    expect(m.user.update).toHaveBeenCalledWith({
      where: { id: "user" },
      // A legacy binary used the switches for reminders and the channel choice for updates.
      data: { emailNotifications: true, smsNotifications: false, notificationChannel: "EMAIL" },
    });
  });
  it("rejects stale writes before mutation", async () => {
    await expect(saveManagement(profile, { ...input(), revision: 1 })).rejects.toThrow(
      "settingsChanged"
    );
    expect(m.notificationSettings.upsert).not.toHaveBeenCalled();
  });
  it("rejects malformed input, partial profiles and rows a scope doesn't control", async () => {
    await expect(saveManagement(profile, input(["whatsapp"]))).rejects.toThrow();
    await expect(saveManagement(profile, { revision: 0, categories: [] })).rejects.toThrow(
      "invalidPreferences"
    );
    await expect(
      saveManagement(profile, { revision: 0, mode: "all", categories: input().categories })
    ).rejects.toThrow();
    await expect(saveManagement(rsvpScope, input())).rejects.toThrow("invalidPreferences");
    await expect(
      saveManagement(rsvpScope, {
        revision: 0,
        categories: [{ category: "updates", channels: [] }],
      })
    ).rejects.toThrow("invalidPreferences");
    expect(m.notificationSettings.upsert).not.toHaveBeenCalled();
  });
  it("saves consent changes without destination proof, and the table lifts old blocks", async () => {
    // Checking a box adds no destination; proof decides separate copies when sending.
    m.notificationSettings.findUnique.mockResolvedValue({ ...stored(), blockedChannels: ["sms"] });
    await saveManagement(profile, input());
    expect(m.notificationSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ blockedChannels: [] }) })
    );
    expect(m.notificationConnection.findUnique).not.toHaveBeenCalled();
    expect(m.notificationBinding.findUnique).not.toHaveBeenCalled();
    expect(m.rSVP.update).not.toHaveBeenCalled();
  });
  it("keeps channels the site hides right now", async () => {
    m.offered.mockResolvedValue(["email"]);
    m.notificationSettings.findUnique.mockResolvedValue({
      ...stored(),
      blockedChannels: ["sms"],
      categories: [{ category: "updates", channels: ["sms"] }],
    });
    await saveManagement(profile, input(["email"]));
    const rows = m.notificationCategoryPreference.createMany.mock.calls[0][0].data;
    // Updates kept its hidden SMS choice; rows with no stored choice keep the default's.
    expect(rows[0]).toEqual({
      settingsId: "profile:user",
      category: "updates",
      channels: ["email", "sms"],
    });
    expect(rows[1].channels).toEqual(["email", "sms"]);
    // The block on a hidden channel stays until the table can show that channel.
    expect(m.notificationSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ blockedChannels: ["sms"] }) })
    );
  });
  it("lets the table turn every message off", async () => {
    await saveManagement(profile, input([]));
    expect(m.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailNotifications: false, smsNotifications: false }),
      })
    );
  });
  it("saves event rows without writing account preferences, or none to follow the profile", async () => {
    const rows = ["updates", "reminders", "confirmations"].map((category) => ({
      category,
      channels: category === "updates" ? [] : ["email"],
    }));
    await saveManagement(rsvpScope, { revision: 0, categories: rows });
    expect(m.user.update).not.toHaveBeenCalled();
    expect(m.notificationCategoryPreference.createMany).toHaveBeenCalledWith({
      data: rows.map((row) => ({ settingsId: "rsvp:rsvp", ...row })),
    });
    vi.clearAllMocks();
    m.notificationSettings.findUnique.mockResolvedValue(null);
    await saveManagement(rsvpScope, { revision: 0, categories: [] });
    expect(m.notificationCategoryPreference.deleteMany).toHaveBeenCalledWith({
      where: { settingsId: "rsvp:rsvp" },
    });
    expect(m.notificationCategoryPreference.createMany).toHaveBeenCalledWith({ data: [] });
  });
});
describe("destination proof and revocation", () => {
  it("creates a short-lived hashed challenge and never enables delivery", async () => {
    const result = await requestDestinationProof(profile, {
      channel: "email",
      destination: "NEW@example.com",
    });
    expect(result).toEqual({ challengeId: "challenge" });
    const code = m.deliver.mock.calls[0][0].code;
    const data = m.notificationChallenge.create.mock.calls[0][0].data;
    expect(data.destination).toBe("new@example.com");
    expect(data.secretHash).toBe(hashToken(code));
    expect(data.secretHash).not.toBe(code);
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60000);
    expect(m.notificationSettings.upsert).not.toHaveBeenCalled();
    expect(m.user.update).not.toHaveBeenCalled();
  });
  it("fails closed for invalid destinations, unavailable services and rate limits", async () => {
    await expect(
      requestDestinationProof(profile, { channel: "email", destination: "bad" })
    ).rejects.toThrow("invalidDestination");
    m.rate.mockResolvedValue({ success: false });
    await expect(
      requestDestinationProof(profile, { channel: "email", destination: "valid@example.com" })
    ).rejects.toThrow("rateLimited");
    m.rate.mockResolvedValue({ success: true });
    m.notificationChallenge.findFirst.mockResolvedValue({ id: "recent" });
    await expect(
      requestDestinationProof(profile, { channel: "email", destination: "valid@example.com" })
    ).rejects.toThrow("rateLimited");
    m.notificationChallenge.findFirst.mockResolvedValue(null);
    m.deliver.mockResolvedValue({ summary: { accepted: 0, uncertain: 0 } });
    await expect(
      requestDestinationProof(profile, { channel: "email", destination: "valid@example.com" })
    ).rejects.toThrow("verificationUnavailable");
  });
  it.each([
    { usedAt: new Date() },
    { expiresAt: new Date(0) },
    { attempts: 5 },
    { userId: "foreign" },
    { rsvpId: "foreign" },
  ])("rejects expired, replayed, exhausted and foreign challenges", async (override) => {
    m.notificationChallenge.findUnique.mockResolvedValue({
      id: "challenge",
      userId: "user",
      rsvpId: null,
      channel: "email",
      destination: "new@example.com",
      expiresAt: new Date(Date.now() + 60000),
      attempts: 0,
      usedAt: null,
      secretHash: hashToken("12345678"),
      ...override,
    });
    await expect(
      verifyDestinationProof(profile, { challengeId: "challenge", code: "12345678" })
    ).rejects.toThrow("invalidProof");
    expect(m.notificationConnection.upsert).not.toHaveBeenCalled();
  });
  it("counts incorrect attempts without consuming a valid challenge", async () => {
    m.notificationChallenge.findUnique.mockResolvedValue({
      id: "challenge",
      userId: "user",
      rsvpId: null,
      channel: "email",
      expiresAt: new Date(Date.now() + 60000),
      attempts: 0,
      usedAt: null,
      secretHash: hashToken("12345678"),
    });
    await expect(
      verifyDestinationProof(profile, { challengeId: "challenge", code: "87654321" })
    ).rejects.toThrow("invalidProof");
    expect(m.notificationChallenge.update).toHaveBeenCalledWith({
      where: { id: "challenge" },
      data: { attempts: { increment: 1 } },
    });
    expect(m.notificationConnection.upsert).not.toHaveBeenCalled();
  });
  it("verifies a connection without changing login or event contacts", async () => {
    m.notificationChallenge.findUnique.mockResolvedValue({
      id: "challenge",
      userId: "user",
      rsvpId: null,
      channel: "email",
      destination: "new@example.com",
      expiresAt: new Date(Date.now() + 60000),
      attempts: 0,
      usedAt: null,
      secretHash: hashToken("12345678"),
    });
    await verifyDestinationProof(profile, { challengeId: "challenge", code: "12345678" });
    expect(m.notificationConnection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: "user", destination: "new@example.com" }),
      })
    );
    expect(m.rSVP.update).not.toHaveBeenCalled();
    expect(m.user.update).not.toHaveBeenCalled();
  });
  it("removing a verified address revokes its proof everywhere without blocking the channel", async () => {
    m.notificationConnection.findUnique.mockResolvedValue({ id: "connection", revokedAt: null });
    await removeConnection(profile, "email");
    expect(m.notificationConnection.update).toHaveBeenCalledWith({
      where: { id: "connection" },
      data: { revokedAt: expect.any(Date), generation: { increment: 1 } },
    });
    expect(m.notificationBinding.updateMany).toHaveBeenCalledWith({
      where: { connectionId: "connection" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(m.notificationChallenge.updateMany).toHaveBeenCalled();
    expect(m.notificationSettings.upsert).not.toHaveBeenCalled();
    expect(m.user.update).not.toHaveBeenCalled();
  });
  it("removes reusable addresses only from the profile", async () => {
    await expect(removeConnection(rsvpScope, "email")).rejects.toThrow("unauthorized");
  });
  it("re-proving the same active address keeps the events already using it", async () => {
    m.notificationChallenge.findUnique.mockResolvedValue({
      id: "challenge",
      userId: "user",
      rsvpId: null,
      channel: "email",
      destination: "same@example.com",
      expiresAt: new Date(Date.now() + 60000),
      attempts: 0,
      usedAt: null,
      secretHash: hashToken("12345678"),
    });
    m.notificationConnection.findUnique.mockResolvedValue({
      id: "connection",
      destination: "same@example.com",
      revokedAt: null,
    });
    await verifyDestinationProof(profile, { challengeId: "challenge", code: "12345678" });
    expect(m.notificationBinding.updateMany).not.toHaveBeenCalled();
    expect(m.notificationConnection.upsert).not.toHaveBeenCalled();
  });
});
