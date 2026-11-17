// #792 root cause: public contact text authorized an existing invitation mutation.
// Exercise real PostgreSQL proof consumption, invitation state, and concurrent saves.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db, truncateAll } from "@/tests/integration/helpers/db";
import { hashToken } from "@/lib/hash";
import {
  requestRsvpVerification,
  verifyRsvpVerification,
  addRSVP,
  updateRSVP,
} from "@/app/actions/event/rsvp";
import { deliver, notifyRsvp, notifyHostAlert } from "@/lib/notifications/service";
vi.mock("@/lib/clientIp", () => ({ isTrustedIpConfigured: () => false }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: async () => ({ success: true }) }));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: async () => {} }));
vi.mock("@/lib/eventAccess", () => ({ resolveEventAccess: async () => ({ decision: "granted" }) }));
vi.mock("@/lib/session-user", () => ({ getSessionUser: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications/service", () => ({
  offeredChannels: async () => ["email", "sms"],
  deliver: vi.fn().mockResolvedValue({ summary: { accepted: 1, uncertain: 0 } }),
  notifyRsvp: vi.fn().mockResolvedValue(undefined),
  notifyHostAlert: vi.fn().mockResolvedValue(undefined),
}));
beforeEach(async () => {
  vi.clearAllMocks();
  await truncateAll();
});
async function seed(channel: "email" | "sms" = "email") {
  const host = await db.user.create({ data: { email: "host@example.com", role: "HOST" } });
  const event = await db.event.create({
    data: {
      hostId: host.id,
      title: "Party",
      slug: "party",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      startAt: new Date("2099-01-01"),
      plusOneAllowed: true,
      plusOneMax: 3,
      hostAlertEmail: true,
    },
  });
  const contact =
    channel === "email" ? { guestEmail: "alice@example.com" } : { guestPhone: "+15551234567" };
  const guest = await db.user.create({
    data: channel === "email" ? { email: contact.guestEmail } : { phone: contact.guestPhone },
  });
  const rsvp = await db.rSVP.create({
    data: {
      eventId: event.id,
      userId: guest.id,
      guestName: "Alice",
      ...contact,
      status: "INVITED",
      responded: false,
      approved: false,
      note: "Original note",
      plusOneCount: 1,
      plusOneGuests: { create: { name: "Original companion", order: 0 } },
    },
  });
  const field = await db.rSVPField.create({
    data: { eventId: event.id, label: "Food", fieldType: "TEXT" },
  });
  await db.rSVPAnswer.create({
    data: { rsvpId: rsvp.id, rsvpFieldId: field.id, value: "Original answer" },
  });
  const invitation = await db.invitation.create({
    data: {
      eventId: event.id,
      rsvpId: rsvp.id,
      channel: channel === "email" ? "EMAIL" : "SMS",
      sentTo: contact.guestEmail ?? contact.guestPhone!,
    },
  });
  const input = {
    eventId: event.id,
    guestName: "Changed",
    ...contact,
    status: "GOING",
    note: "Changed note",
    plusOneCount: 1,
    plusOneGuestNames: ["New companion"],
    answers: { [field.id]: "New answer" },
  };
  return { event, rsvp, input, invitation, field };
}
async function prove(eventId: string, channel: "email" | "sms", destination: string) {
  const request = await requestRsvpVerification({ eventId, channel, destination });
  if (!request.success) throw new Error(request.error);
  const message = vi.mocked(deliver).mock.calls.at(-1)![0];
  if (message.kind !== "connection_verification") throw new Error("Expected verification");
  const verified = await verifyRsvpVerification({
    eventId,
    challengeId: request.challengeId,
    code: message.code,
  });
  if (!verified.success) throw new Error(verified.error);
  return verified.proof;
}
const snapshot = (id: string) =>
  db.rSVP.findUniqueOrThrow({ where: { id }, include: { answers: true, plusOneGuests: true } });

describe("#792 invitation authority with real database transactions", () => {
  it.each(["email", "sms"] as const)(
    "never changes an invitation from typed %s alone",
    async (channel) => {
      const { rsvp, input } = await seed(channel);
      const before = await snapshot(rsvp.id);
      const result = await addRSVP(input);
      expect(result).toMatchObject({ success: false, verificationRequired: true });
      expect(JSON.stringify(result)).not.toContain(rsvp.editToken);
      expect(await snapshot(rsvp.id)).toEqual(before);
      expect(notifyRsvp).not.toHaveBeenCalled();
      expect(notifyHostAlert).not.toHaveBeenCalled();
      expect(await db.rSVP.count()).toBe(1);
    }
  );
  it.each(["email", "sms"] as const)(
    "answers only after %s proof and explicit final submission",
    async (channel) => {
      const { event, rsvp, input } = await seed(channel);
      const before = await snapshot(rsvp.id);
      const proof = await prove(event.id, channel, input.guestEmail ?? input.guestPhone!);
      expect(await snapshot(rsvp.id)).toEqual(before);
      expect(notifyRsvp).not.toHaveBeenCalled();
      const saved = await addRSVP(input, null, [proof]);
      expect(saved).toMatchObject({ success: true, id: rsvp.id, editToken: rsvp.editToken });
      const after = await snapshot(rsvp.id);
      expect(after).toMatchObject({
        status: "GOING",
        responded: true,
        guestName: "Changed",
        guestEmail: rsvp.guestEmail,
        guestPhone: rsvp.guestPhone,
        answers: [expect.objectContaining({ value: "New answer" })],
        plusOneGuests: [expect.objectContaining({ name: "New companion" })],
      });
      expect(await db.rSVP.count()).toBe(1);
      expect(notifyRsvp).toHaveBeenCalledTimes(1);
      expect(
        (await db.rsvpContactChallenge.findUniqueOrThrow({ where: { id: proof.challengeId } }))
          .usedAt
      ).not.toBeNull();
      expect(await addRSVP(input, null, [proof])).toMatchObject({ success: false });
    }
  );
  it("does not give an attacker with a proved phone authority over an unproved invitee email", async () => {
    const { event, rsvp, input } = await seed();
    const before = await snapshot(rsvp.id);
    const proof = await prove(event.id, "sms", "+15559876543");
    expect(await addRSVP({ ...input, guestPhone: "+15559876543" }, null, [proof])).toMatchObject({
      success: false,
    });
    expect(await snapshot(rsvp.id)).toEqual(before);
  });
  it("does not match an invitation through another contact on its linked account", async () => {
    const { event, rsvp } = await seed();
    await db.user.update({ where: { id: rsvp.userId! }, data: { phone: "+15559876543" } });
    const before = await snapshot(rsvp.id);
    const proof = await prove(event.id, "sms", "+15559876543");
    const result = await addRSVP(
      { eventId: event.id, guestName: "Someone", guestPhone: "+15559876543", status: "MAYBE" },
      null,
      [proof]
    );
    expect(result.success).toBe(true);
    expect(await snapshot(rsvp.id)).toEqual(before);
  });
  it("requires proof for both contacts and preserves an invitation's existing contacts", async () => {
    const { event, rsvp, input } = await seed();
    const proofs = [
      await prove(event.id, "email", input.guestEmail!),
      await prove(event.id, "sms", "+15559876543"),
    ];
    expect((await addRSVP({ ...input, guestPhone: "+15559876543" }, null, proofs)).success).toBe(
      true
    );
    expect(await snapshot(rsvp.id)).toMatchObject({
      guestEmail: "alice@example.com",
      guestPhone: null,
    });
  });
  it("rejects proof for a different destination or event", async () => {
    const { event, rsvp, input } = await seed();
    const proof = await prove(event.id, "email", "someone@example.com");
    expect(await addRSVP(input, null, [proof])).toMatchObject({ success: false });
    const other = await db.event.create({
      data: {
        hostId: event.hostId,
        title: "Other",
        slug: "other",
        status: "PUBLISHED",
        startAt: event.startAt,
      },
    });
    expect(
      await addRSVP(
        {
          eventId: other.id,
          guestName: "Someone",
          guestEmail: "someone@example.com",
          status: "MAYBE",
        },
        null,
        [proof]
      )
    ).toMatchObject({ success: false });
    expect((await snapshot(rsvp.id)).status).toBe("INVITED");
  });
  it("locks a challenge after five incorrect code guesses", async () => {
    const { event, rsvp } = await seed();
    const id = randomUUID();
    await db.rsvpContactChallenge.create({
      data: {
        id,
        eventId: event.id,
        channel: "email",
        destination: "alice@example.com",
        secretHash: hashToken("12345678"),
        expiresAt: new Date(Date.now() + 900000),
      },
    });
    for (let i = 0; i < 5; i++)
      expect(
        (await verifyRsvpVerification({ eventId: event.id, challengeId: id, code: "87654321" }))
          .success
      ).toBe(false);
    expect(
      (await verifyRsvpVerification({ eventId: event.id, challengeId: id, code: "12345678" }))
        .success
    ).toBe(false);
    expect((await snapshot(rsvp.id)).status).toBe("INVITED");
    expect((await db.rsvpContactChallenge.findUniqueOrThrow({ where: { id } })).attempts).toBe(5);
  });
  it("consumes a code and its final receipt exactly once under concurrent requests", async () => {
    const { event, input } = await seed();
    const request = await requestRsvpVerification({
      eventId: event.id,
      channel: "email",
      destination: input.guestEmail,
    });
    if (!request.success) throw new Error(request.error);
    const message = vi.mocked(deliver).mock.calls.at(-1)![0];
    if (message.kind !== "connection_verification") throw new Error("Expected verification");
    const checked = await Promise.all(
      Array.from({ length: 4 }, () =>
        verifyRsvpVerification({
          eventId: event.id,
          challengeId: request.challengeId,
          code: message.code,
        })
      )
    );
    const success = checked.filter((result) => result.success);
    expect(success).toHaveLength(1);
    const saved = await Promise.all(
      Array.from({ length: 4 }, () => addRSVP(input, null, [success[0].proof]))
    );
    expect(saved.filter((result) => result.success)).toHaveLength(1);
    expect(notifyRsvp).toHaveBeenCalledTimes(1);
  });
  it("keeps private invitation links usable without public contact proof", async () => {
    const { rsvp } = await seed();
    expect(await updateRSVP(rsvp.editToken, { status: "MAYBE" })).toMatchObject({
      success: true,
      rsvpId: rsvp.id,
    });
    expect((await snapshot(rsvp.id)).status).toBe("MAYBE");
  });
  it("rechecks the deadline and leaves proof unconsumed when saving fails", async () => {
    const { event, input } = await seed();
    const proof = await prove(event.id, "email", input.guestEmail!);
    await db.event.update({ where: { id: event.id }, data: { rsvpDeadline: new Date(0) } });
    expect(await addRSVP(input, null, [proof])).toMatchObject({
      success: false,
      error: "RSVP deadline has passed",
    });
    expect(
      (await db.rsvpContactChallenge.findUniqueOrThrow({ where: { id: proof.challengeId } })).usedAt
    ).toBeNull();
  });
  it("does not authorize a former invitation address after its event contact changes", async () => {
    const { event, rsvp, input } = await seed();
    await db.rSVP.update({
      where: { id: rsvp.id },
      data: { guestEmail: "replacement@example.com" },
    });
    const before = await snapshot(rsvp.id);
    const proof = await prove(event.id, "email", "alice@example.com");
    expect(await addRSVP(input, null, [proof])).toMatchObject({
      success: false,
      error: "Use your private RSVP link or contact the host to update this response.",
    });
    expect(await snapshot(rsvp.id)).toEqual(before);
  });
  it("refuses to combine two proved contacts belonging to different invitations", async () => {
    const { event, rsvp, input } = await seed();
    const other = await db.rSVP.create({
      data: {
        eventId: event.id,
        guestName: "Other",
        guestPhone: "+15559876543",
        status: "INVITED",
        responded: false,
      },
    });
    const before = await snapshot(rsvp.id);
    const proofs = [
      await prove(event.id, "email", "alice@example.com"),
      await prove(event.id, "sms", "+15559876543"),
    ];
    expect(await addRSVP({ ...input, guestPhone: "+15559876543" }, null, proofs)).toMatchObject({
      success: false,
    });
    expect(await snapshot(rsvp.id)).toEqual(before);
    expect((await snapshot(other.id)).status).toBe("INVITED");
  });
});
