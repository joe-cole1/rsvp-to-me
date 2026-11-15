// #848 root cause: the Redis capacity lock expired or ran unlocked on failure;
// mocked lock tests never exercised two real DB writers. Use real transactions.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, truncateAll } from "@/tests/integration/helpers/db";
import { createGuestRsvp, updateGuestRsvp } from "@/lib/rsvp-service";
import { AddRsvpSchema, UpdateRsvpSchema } from "@/lib/schemas";
import { notifyRsvp, notifyHostAlert } from "@/lib/notifications/service";
import { logActivity } from "@/lib/activity";
import { POST } from "@/app/api/webhooks/twilio/route";
import { withEventCapacityLock } from "@/lib/capacityLock";
import { NextRequest } from "next/server";
import crypto from "node:crypto";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/session-user", () => ({ getSessionUser: async () => null }));
vi.mock("@/lib/notifications/service", () => ({
  notifyRsvp: vi.fn().mockResolvedValue(undefined),
  notifyHostAlert: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/sms", () => ({ resolveTwilioAuthToken: async () => "fixture-token" }));
// Capacity safety must not depend on Redis being configured or available.
vi.mock("@/lib/redis", () => ({ isRedisEnabled: () => false }));
beforeEach(async () => {
  await truncateAll();
  vi.clearAllMocks();
});
async function seed(overrides = {}) {
  const host = await db.user.create({
    data: { email: "host@test.com", name: "Host", role: "HOST" },
  });
  return db.event.create({
    data: {
      hostId: host.id,
      slug: "party",
      title: "Party",
      visibility: "PUBLIC",
      status: "PUBLISHED",
      startAt: new Date("2099-01-01"),
      capacity: 1,
      ...overrides,
    },
  });
}
function add(eventId: string, guestName: string) {
  return createGuestRsvp(AddRsvpSchema.parse({ eventId, guestName, status: "GOING" }));
}
function edit(token: string) {
  return updateGuestRsvp(token, UpdateRsvpSchema.parse({ status: "GOING" }));
}
async function invited(eventId: string, phone = "+15551234567") {
  const rsvp = await db.rSVP.create({
    data: { eventId, guestName: "Invitee", guestPhone: phone, status: "INVITED", responded: false },
  });
  await db.invitation.create({ data: { eventId, rsvpId: rsvp.id, sentTo: phone, channel: "SMS" } });
  return rsvp;
}
function sms(body = "YES") {
  const url = "http://localhost:3000/api/webhooks/twilio";
  const params = new URLSearchParams({ Body: body, From: "+15551234567" });
  const canonical = [...params.keys()].sort().reduce((s, k) => s + k + params.get(k), url);
  const signature = crypto.createHmac("sha1", "fixture-token").update(canonical).digest("base64");
  return POST(
    new NextRequest(url, {
      method: "POST",
      headers: { "x-twilio-signature": signature },
      body: params.toString(),
    })
  );
}
describe("#848: real concurrent RSVP writes without Redis", () => {
  it("waits beyond the former Redis retry window and validates rules after acquisition", async () => {
    const event = await seed();
    let release!: () => void;
    let ready!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const acquired = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const holder = withEventCapacityLock(event.id, async () => {
      ready();
      await held;
    });
    await acquired;
    let finished = false;
    const submission = add(event.id, "Waiting guest").then((result) => {
      finished = true;
      return result;
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      expect(finished).toBe(false);
      await db.event.update({
        where: { id: event.id },
        data: { rsvpDeadline: new Date("2000-01-01") },
      });
    } finally {
      release();
    }
    await holder;
    expect(await submission).toMatchObject({ success: false, reason: "deadlinePassed" });
    expect(await db.rSVP.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("admits exactly one of eight concurrent new submissions for the last seat", async () => {
    const event = await seed();
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => add(event.id, `Guest ${i}`))
    );
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(results.filter((r) => !r.success && r.reason === "atCapacity")).toHaveLength(7);
    expect(await db.rSVP.count({ where: { eventId: event.id, status: "GOING" } })).toBe(1);
  });
  it("serializes an edit and new submission competing for one seat", async () => {
    const event = await seed();
    const existing = await db.rSVP.create({
      data: { eventId: event.id, guestName: "Maybe", status: "MAYBE" },
    });
    const results = await Promise.all([edit(existing.editToken), add(event.id, "New")]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(await db.rSVP.count({ where: { eventId: event.id, status: "GOING" } })).toBe(1);
  });
  it("rereads an already-admitted RSVP so simultaneous edits do not reject its held seat", async () => {
    const event = await seed();
    const existing = await invited(event.id);
    const results = await Promise.all([edit(existing.editToken), edit(existing.editToken)]);
    expect(results.every((r) => r.success)).toBe(true);
    await vi.waitFor(() => expect(notifyRsvp).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(notifyHostAlert).toHaveBeenCalledTimes(1));
    expect(vi.mocked(logActivity).mock.calls.filter((c) => c[1] === "rsvp_new")).toHaveLength(1);
  });
  it("serializes a signed SMS reply and a web submission", async () => {
    const event = await seed();
    await invited(event.id, "(555) 123-4567");
    const [reply, web] = await Promise.all([sms(), add(event.id, "Web guest")]);
    const xml = await reply.text();
    expect(Number(web.success) + Number(xml.includes("Got it!"))).toBe(1);
    expect(await db.rSVP.count({ where: { eventId: event.id, status: "GOING" } })).toBe(1);
  });
  it("records SMS first-response activity, confirmations and host alerts once despite resends", async () => {
    const event = await seed();
    const rsvp = await invited(event.id, "15551234567");
    await db.invitation.create({
      data: { eventId: event.id, rsvpId: rsvp.id, sentTo: "15551234567", channel: "SMS" },
    });
    await Promise.all([sms(), sms()]);
    expect(await db.rSVP.findUnique({ where: { id: rsvp.id } })).toMatchObject({
      status: "GOING",
      responded: true,
    });
    await vi.waitFor(() => expect(notifyRsvp).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(notifyHostAlert).toHaveBeenCalledTimes(1));
    expect(vi.mocked(logActivity).mock.calls.filter((c) => c[1] === "rsvp_new")).toHaveLength(1);
  });
  it.each([
    [{ startAt: new Date("2000-01-01") }, "YES", "closed"],
    [{ rsvpDeadline: new Date("2000-01-01") }, "YES", "closed"],
    [{ maybeEnabled: false }, "MAYBE", "doesn"],
  ] as const)(
    "enforces event rules for signed SMS replies: %j",
    async (settings, body, message) => {
      const event = await seed(settings);
      const rsvp = await invited(event.id);
      expect(await (await sms(body)).text()).toContain(message);
      expect(await db.rSVP.findUnique({ where: { id: rsvp.id } })).toMatchObject({
        status: "INVITED",
        responded: false,
      });
      expect(notifyRsvp).not.toHaveBeenCalled();
      expect(notifyHostAlert).not.toHaveBeenCalled();
      expect(logActivity).not.toHaveBeenCalled();
    }
  );
  it("allows signed SMS first responses after the deadline when editing is enabled", async () => {
    const event = await seed({
      rsvpDeadline: new Date("2000-01-01"),
      allowEditAfterDeadline: true,
    });
    const rsvp = await invited(event.id);
    expect(await (await sms()).text()).toContain("Got it!");
    expect(await db.rSVP.findUnique({ where: { id: rsvp.id } })).toMatchObject({
      status: "GOING",
      responded: true,
    });
  });
  it("revalidates SMS contact ownership inside the transaction", async () => {
    const event = await seed();
    const rsvp = await invited(event.id);
    const invitation = await db.invitation.findFirstOrThrow({ where: { rsvpId: rsvp.id } });
    await db.rSVP.update({ where: { id: rsvp.id }, data: { guestPhone: "+15559999999" } });
    expect(
      await updateGuestRsvp(rsvp.editToken, UpdateRsvpSchema.parse({ status: "GOING" }), {
        phone: "+15551234567",
        invitationId: invitation.id,
      })
    ).toMatchObject({ success: false, reason: "forbidden" });
    expect(notifyRsvp).not.toHaveBeenCalled();
  });
});
