import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, truncateAll } from "../helpers/db";
const m = vi.hoisted(() => ({ user: vi.fn(), deliver: vi.fn() }));
vi.mock("@/lib/session-user", () => ({ getSessionUser: m.user }));
vi.mock("@/lib/config", () => ({ getChannelConfig: async () => ({ email: true, sms: true }) }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: async () => "127.0.0.1" }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: async () => ({ success: true }) }));
vi.mock("@/lib/notifications/service", async (original) => ({
  ...(await original<typeof import("@/lib/notifications/service")>()),
  deliver: m.deliver,
  // Provider availability is site configuration; these tests exercise authority only.
  offeredChannels: async () => ["email", "sms"],
}));
import {
  authorizeManagement,
  requestDestinationProof,
  verifyDestinationProof,
  saveManagement,
  removeConnection,
  readManagement,
} from "@/lib/notifications/manage";
import { resolveRecipients, recipientSelect } from "@/lib/notifications/resolve";
import { bindNotificationConnection } from "@/app/actions/notifications";
import { resolveHostRecipients } from "@/lib/notifications/service";
beforeEach(async () => {
  await truncateAll();
  vi.clearAllMocks();
  m.user.mockResolvedValue(null);
  m.deliver.mockResolvedValue({ summary: { accepted: 1, uncertain: 0 } });
});
async function fixture() {
  const host = await db.user.create({ data: { email: "host@example.com", role: "HOST" } });
  const user = await db.user.create({ data: { email: "account@example.com" } });
  const event = await db.event.create({
    data: {
      title: "Notification fixture",
      slug: "notification-fixture",
      hostId: host.id,
      startAt: new Date("2099-01-01"),
      status: "PUBLISHED",
      visibility: "PRIVATE",
    },
  });
  const rsvp = await db.rSVP.create({
    data: {
      eventId: event.id,
      userId: user.id,
      guestName: "Event guest",
      guestEmail: "event@example.com",
      status: "GOING",
    },
  });
  const scope = { kind: "rsvp" as const, slug: event.slug, token: rsvp.editToken };
  return { host, user, event, rsvp, scope };
}
async function challenge(scope: unknown, destination = "verified@example.com") {
  const { challengeId } = await requestDestinationProof(scope, { channel: "email", destination });
  return { challengeId, code: m.deliver.mock.calls.at(-1)![0].code as string };
}
describe("notification destination authority with PostgreSQL", () => {
  it("rejects normalized contact collisions without changing either event RSVP", async () => {
    const { user, scope, rsvp, event } = await fixture();
    await db.rSVP.create({
      data: {
        eventId: event.id,
        guestName: "Other guest",
        guestPhone: "+1 (555) 000-2222",
        status: "GOING",
      },
    });
    m.user.mockResolvedValue({ id: user.id });
    const connection = await db.notificationConnection.create({
      data: {
        userId: user.id,
        channel: "sms",
        destination: "+15550002222",
        verifiedAt: new Date(),
      },
    });
    expect((await bindNotificationConnection(scope, connection.id)).success).toBe(false);
    const { challengeId } = await requestDestinationProof(scope, {
      channel: "sms",
      destination: connection.destination,
    });
    const code = m.deliver.mock.calls.at(-1)![0].code as string;
    await expect(verifyDestinationProof(scope, { challengeId, code })).rejects.toThrow(
      "contactConflict"
    );
    expect((await db.rSVP.findUniqueOrThrow({ where: { id: rsvp.id } })).guestPhone).toBeNull();
    expect(await db.notificationBinding.count()).toBe(0);
  });
  it("lets a guest explicitly prove and replace only their event contact", async () => {
    const { user, rsvp, scope } = await fixture();
    await verifyDestinationProof(scope, await challenge(scope));
    expect((await db.rSVP.findUniqueOrThrow({ where: { id: rsvp.id } })).guestEmail).toBe(
      "verified@example.com"
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(
      "account@example.com"
    );
    expect(
      await db.notificationBinding.count({ where: { rsvpId: rsvp.id, revokedAt: null } })
    ).toBe(1);
    expect(await db.notificationConnection.count()).toBe(0);
  });
  it("does not grant authority from public IDs or the auto-linked account", async () => {
    const { user, rsvp, event } = await fixture();
    await expect(
      authorizeManagement({ kind: "rsvp", slug: event.slug, rsvpId: rsvp.id })
    ).rejects.toThrow("unauthorized");
    m.user.mockResolvedValue({ id: user.id });
    await expect(
      authorizeManagement({ kind: "rsvp", slug: event.slug, rsvpId: rsvp.id })
    ).rejects.toThrow("proofRequired");
  });
  it("requires the token and event to match", async () => {
    const { scope } = await fixture();
    await expect(authorizeManagement({ ...scope, slug: "foreign" })).rejects.toThrow(
      "unauthorized"
    );
  });
  it("atomically permits only one concurrent proof consumption", async () => {
    const { scope } = await fixture();
    const proof = await challenge(scope);
    const results = await Promise.allSettled([
      verifyDestinationProof(scope, proof),
      verifyDestinationProof(scope, proof),
    ]);
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(await db.notificationBinding.count()).toBe(1);
  });
  it("serializes concurrent proof requests with a resend cooldown", async () => {
    const { scope } = await fixture();
    const results = await Promise.allSettled([
      requestDestinationProof(scope, { channel: "email", destination: "one@example.com" }),
      requestDestinationProof(scope, { channel: "email", destination: "two@example.com" }),
    ]);
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(await db.notificationChallenge.count()).toBe(1);
  });
  it("commits wrong-attempt limits without granting or consuming proof", async () => {
    const { scope } = await fixture();
    const proof = await challenge(scope);
    for (let i = 0; i < 5; i++)
      await expect(verifyDestinationProof(scope, { ...proof, code: "00000000" })).rejects.toThrow(
        "invalidProof"
      );
    await expect(verifyDestinationProof(scope, proof)).rejects.toThrow("invalidProof");
    const row = await db.notificationChallenge.findUniqueOrThrow({
      where: { id: proof.challengeId },
    });
    expect(row.attempts).toBe(5);
    expect(row.usedAt).toBeNull();
    expect(await db.notificationBinding.count()).toBe(0);
  });
  it("removing a profile address invalidates its pending proof without blocking the channel", async () => {
    const { user } = await fixture();
    m.user.mockResolvedValue({ id: user.id });
    const profile = { kind: "profile" };
    const proof = await challenge(profile);
    await removeConnection(profile, "email");
    await expect(verifyDestinationProof(profile, proof)).rejects.toThrow("invalidProof");
    // Verification and consent are separate: nothing was blocked or rewritten.
    expect(await db.notificationSettings.count()).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailNotifications).toBe(
      true
    );
  });
  it("keeps profile enrollment separate from authentication and existing event destinations", async () => {
    const { user, rsvp } = await fixture();
    m.user.mockResolvedValue({ id: user.id });
    const scope = { kind: "profile" };
    await verifyDestinationProof(scope, await challenge(scope));
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(
      "account@example.com"
    );
    expect((await db.rSVP.findUniqueOrThrow({ where: { id: rsvp.id } })).guestEmail).toBe(
      "event@example.com"
    );
    expect(await db.session.count()).toBe(0);
    expect(await db.notificationSettings.count()).toBe(0);
  });
  it("allows exactly one of two concurrent preference writes at the same revision", async () => {
    const { user } = await fixture();
    m.user.mockResolvedValue({ id: user.id });
    const data = {
      revision: 0,
      categories: ["updates", "reminders", "confirmations", "host_alerts"].map((category) => ({
        category,
        channels: ["email"],
      })),
    };
    const results = await Promise.allSettled([
      saveManagement({ kind: "profile" }, data),
      saveManagement({ kind: "profile" }, data),
    ]);
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect((await readManagement({ kind: "profile" })).revision).toBe(1);
  });
  it("reuses a proved profile connection only after an event-authorized explicit selection", async () => {
    const { user, scope, rsvp } = await fixture();
    m.user.mockResolvedValue({ id: user.id });
    await verifyDestinationProof({ kind: "profile" }, await challenge({ kind: "profile" }));
    const connection = await db.notificationConnection.findUniqueOrThrow({
      where: { userId_channel: { userId: user.id, channel: "email" } },
    });
    expect((await bindNotificationConnection(scope, connection.id)).success).toBe(true);
    expect((await db.rSVP.findUniqueOrThrow({ where: { id: rsvp.id } })).guestEmail).toBe(
      connection.destination
    );
    await removeConnection({ kind: "profile" }, "email");
    const rows = await db.rSVP.findMany({ where: { id: rsvp.id }, select: recipientSelect });
    expect((await resolveRecipients("updates", rows))[0].destinations.email).toBeUndefined();
    // The event contact stays paused: inheriting or re-saving cannot resurrect revoked proof.
    await saveManagement(scope, { revision: 0, categories: [] });
    expect((await resolveRecipients("updates", rows))[0].destinations.email).toBeUndefined();
  });
  it("does not redirect existing organizer destinations when a connection is enrolled", async () => {
    const { host, event } = await fixture();
    m.user.mockResolvedValue({ id: host.id });
    await verifyDestinationProof({ kind: "profile" }, await challenge({ kind: "profile" }));
    expect((await resolveHostRecipients(event.id))[0].destinations.email).toBe("host@example.com");
    const connection = await db.notificationConnection.findUniqueOrThrow({
      where: { userId_channel: { userId: host.id, channel: "email" } },
    });
    expect(
      (await bindNotificationConnection({ kind: "organizer", eventId: event.id }, connection.id))
        .success
    ).toBe(true);
    expect((await resolveHostRecipients(event.id))[0].destinations.email).toBe(
      connection.destination
    );
  });
  it("keeps the account contact the event covered after an organizer's first save", async () => {
    // Root cause (01a1a105 QC): a first organizer write stored no eligibility, silently
    // stopping alerts to the account email while the page still claimed email delivery.
    const { host, event } = await fixture();
    m.user.mockResolvedValue({ id: host.id });
    const organizer = { kind: "organizer" as const, eventId: event.id };
    await saveManagement(organizer, {
      revision: 0,
      categories: [{ category: "host_alerts", channels: ["email"] }],
    });
    expect((await resolveHostRecipients(event.id))[0].destinations.email).toBe("host@example.com");
    expect(
      (
        await db.notificationSettings.findUniqueOrThrow({
          where: { id: `organizer:${event.id}:${host.id}` },
        })
      ).legacyChannels
    ).toEqual(["email"]);
  });
});
