import { describe, it, expect, beforeEach, vi } from "vitest";
import { truncateAll, db } from "../helpers/db";

// Mock only Next.js runtime APIs that don't exist in Node.js
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));
// Email/SMS are fire-and-forget (.catch(() => {})), but mock to avoid SMTP/Twilio errors
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendApprovalEmail: vi.fn().mockResolvedValue(undefined),
  sendBlastEmail: vi.fn().mockResolvedValue(undefined),
  sendEventInviteEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn().mockResolvedValue(undefined),
  sendApprovalSms: vi.fn().mockResolvedValue(undefined),
  sendSmsBlast: vi.fn().mockResolvedValue(undefined),
  sendEventInviteSms: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
  iconLabel: vi.fn().mockReturnValue(""),
}));
vi.mock("@/lib/redis", () => ({
  redisGet: vi.fn().mockResolvedValue(null),
  redisSet: vi.fn().mockResolvedValue(undefined),
  redisDel: vi.fn().mockResolvedValue(undefined),
  isRedisEnabled: vi.fn().mockReturnValue(false),
}));

import { addRSVP } from "@/app/actions/event";

async function seedHost() {
  return db.user.create({
    data: { email: `host-${Date.now()}@test.com`, name: "Test Host", role: "HOST" },
  });
}

async function seedEvent(hostId: string, overrides: Record<string, unknown> = {}) {
  return db.event.create({
    data: {
      title: "Integration Test Party",
      slug: `int-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      startAt: new Date("2030-12-01T20:00:00Z"),
      timezone: "America/New_York",
      locationType: "PHYSICAL",
      hostId,
      ...overrides,
    },
  });
}

beforeEach(async () => {
  await truncateAll();
});

describe("addRSVP — real DB integration", () => {
  it("creates an RSVP row in the database", async () => {
    const host = await seedHost();
    const event = await seedEvent(host.id);

    const result = await addRSVP({
      eventId: event.id,
      guestName: "Alice",
      status: "GOING",
    });

    expect(result).toMatchObject({ success: true });
    if (!result.success) throw new Error("Expected success");

    const rsvp = await db.rSVP.findUnique({ where: { id: result.id } });
    expect(rsvp).not.toBeNull();
    expect(rsvp!.guestName).toBe("Alice");
    expect(rsvp!.status).toBe("GOING");
    expect(rsvp!.approved).toBe(true);
  });

  it("enforces event capacity for GOING RSVPs", async () => {
    const host = await seedHost();
    const event = await seedEvent(host.id, { capacity: 2 });

    // Fill capacity
    await addRSVP({ eventId: event.id, guestName: "Guest 1", status: "GOING" });
    await addRSVP({ eventId: event.id, guestName: "Guest 2", status: "GOING" });

    // Third GOING RSVP should be rejected
    const result = await addRSVP({ eventId: event.id, guestName: "Guest 3", status: "GOING" });
    expect(result).toMatchObject({ success: false, error: "Event is at capacity" });

    // MAYBE should still be allowed
    const maybeResult = await addRSVP({
      eventId: event.id,
      guestName: "Guest 4",
      status: "MAYBE",
    });
    expect(maybeResult).toMatchObject({ success: true });
  });

  it("sets approved:false when approvalRequired is true", async () => {
    const host = await seedHost();
    const event = await seedEvent(host.id, { approvalRequired: true });

    const result = await addRSVP({ eventId: event.id, guestName: "Bob", status: "GOING" });
    expect(result).toMatchObject({ success: true });
    if (!result.success) throw new Error("Expected success");

    const rsvp = await db.rSVP.findUnique({ where: { id: result.id } });
    expect(rsvp!.approved).toBe(false);
  });

  it("promotes an INVITED RSVP when the same user RSVPs by email", async () => {
    const host = await seedHost();
    const event = await seedEvent(host.id);

    // Create an invited guest user + INVITED RSVP
    const guestUser = await db.user.create({
      data: { email: "alice@example.com", name: "Alice" },
    });
    await db.rSVP.create({
      data: {
        eventId: event.id,
        guestName: "Alice",
        guestEmail: "alice@example.com",
        status: "INVITED",
        approved: false,
        responded: false,
        userId: guestUser.id,
      },
    });

    // Guest RSVPs via the form with the same email
    const result = await addRSVP({
      eventId: event.id,
      guestName: "Alice",
      guestEmail: "alice@example.com",
      status: "GOING",
    });
    expect(result).toMatchObject({ success: true });

    // Should only have one RSVP (the original was updated, not duplicated)
    const rsvps = await db.rSVP.findMany({ where: { eventId: event.id } });
    expect(rsvps).toHaveLength(1);
    expect(rsvps[0].status).toBe("GOING");
    expect(rsvps[0].responded).toBe(true);
  });

  it("returns error for non-existent event", async () => {
    const result = await addRSVP({
      eventId: "does-not-exist",
      guestName: "Alice",
      status: "GOING",
    });
    expect(result).toMatchObject({ success: false, error: "Event not found" });
  });
});
