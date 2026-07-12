// SEC-38 — RSVP questionnaire `answers` unvalidated.
//
// Bug (found 2026-07, [cd6748] OWASP audit): `answers` was
// `z.record(z.string(), z.string())` — no length cap on values (unbounded
// storage vs. the capped note/comment fields) and the map keys were written as
// `rsvpFieldId` in addRSVP/updateRSVP without verifying the field belongs to
// the event, so a crafted call could attach answer rows to another event's
// question ids.
//
// Fix: value length capped at 2000 (keys at 100) in both schemas, and
// addRSVP/updateRSVP filter answer keys against the event's own rsvpFields.

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockEventFindUnique,
  mockRsvpCreate,
  mockRsvpFindUnique,
  mockRsvpFindFirst,
  mockRsvpUpdate,
  mockAnswerCreateMany,
  mockAnswerUpsert,
  mockWithLock,
  mockRateLimit,
} = vi.hoisted(() => ({
  mockEventFindUnique: vi.fn(),
  mockRsvpCreate: vi.fn(),
  mockRsvpFindUnique: vi.fn(),
  mockRsvpFindFirst: vi.fn(),
  mockRsvpUpdate: vi.fn(),
  mockAnswerCreateMany: vi.fn(),
  mockAnswerUpsert: vi.fn(),
  mockWithLock: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: mockEventFindUnique },
    rSVP: {
      create: mockRsvpCreate,
      findUnique: mockRsvpFindUnique,
      findFirst: mockRsvpFindFirst,
      update: mockRsvpUpdate,
      count: vi.fn(),
    },
    rSVPAnswer: { createMany: mockAnswerCreateMany, upsert: mockAnswerUpsert },
    plusOneGuest: { deleteMany: vi.fn(), createMany: vi.fn() },
    user: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/capacityLock", () => ({ withEventCapacityLock: mockWithLock }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: vi.fn().mockResolvedValue("127.0.0.1") }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(null),
  iconLabel: vi.fn(),
}));
vi.mock("@/lib/crypto", () => ({ getUnlockSignature: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendRsvpConfirmationEmail: vi.fn(),
  sendApprovalEmail: vi.fn(),
}));
vi.mock("@/lib/sms", () => ({
  sendRsvpConfirmationSms: vi.fn(),
  sendApprovalSms: vi.fn(),
}));

import { addRSVP, updateRSVP } from "@/app/actions/event/rsvp";
import { AddRsvpSchema } from "@/lib/schemas";

const EVENT = {
  id: "evt-1",
  slug: "party",
  title: "Party",
  approvalRequired: false,
  rsvpDeadline: null,
  capacity: null,
  startAt: new Date("2026-12-01T20:00:00Z"),
  host: { name: "Joe", email: "joe@example.com" },
  rsvpFields: [{ id: "field-own" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue({ success: true });
  mockWithLock.mockImplementation(async (_id: string, fn: () => Promise<unknown>) => fn());
  mockEventFindUnique.mockResolvedValue(EVENT);
  mockRsvpCreate.mockResolvedValue({ id: "rsvp-1", editToken: "tok-1" });
  mockAnswerCreateMany.mockResolvedValue({ count: 1 });
  mockAnswerUpsert.mockResolvedValue({});
});

describe("SEC-38: answer value length cap", () => {
  it("rejects an answer value over 2000 chars", () => {
    expect(() =>
      AddRsvpSchema.parse({
        eventId: "evt-1",
        guestName: "Alice",
        status: "GOING",
        plusOneCount: 0,
        answers: { "field-own": "x".repeat(2001) },
      })
    ).toThrow();
  });
});

describe("SEC-38: answer keys scoped to the event's own questions", () => {
  it("addRSVP drops answers keyed to another event's rsvpFieldId", async () => {
    await addRSVP({
      eventId: "evt-1",
      guestName: "Alice",
      status: "GOING",
      plusOneCount: 0,
      answers: { "field-own": "yes", "field-foreign": "injected" },
    });
    expect(mockAnswerCreateMany).toHaveBeenCalledWith({
      data: [{ rsvpId: "rsvp-1", rsvpFieldId: "field-own", value: "yes" }],
    });
  });

  it("updateRSVP drops answers keyed to another event's rsvpFieldId", async () => {
    mockRsvpFindUnique.mockResolvedValue({
      id: "rsvp-1",
      eventId: "evt-1",
      guestName: "Alice",
      status: "GOING",
      event: {
        slug: "party",
        capacity: null,
        rsvpDeadline: null,
        rsvpFields: [{ id: "field-own" }],
      },
    });
    mockRsvpUpdate.mockResolvedValue({});

    await updateRSVP("tok-1", {
      status: "GOING",
      plusOneCount: 0,
      answers: { "field-own": "yes", "field-foreign": "injected" },
    });

    expect(mockAnswerUpsert).toHaveBeenCalledTimes(1);
    expect(mockAnswerUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { rsvpId: "rsvp-1", rsvpFieldId: "field-own", value: "yes" },
      })
    );
  });
});
