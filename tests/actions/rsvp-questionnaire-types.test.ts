import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { AddRsvpSchema, UpdateRsvpSchema } from "@/lib/schemas";
import { createGuestRsvp, updateGuestRsvp } from "@/lib/rsvp-service";
import { TERMS_ACCEPTED_VALUE } from "@/lib/rsvp-fields";

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
    $executeRaw: vi.fn(),
    event: { findUnique: vi.fn() },
    user: { upsert: vi.fn() },
    rSVP: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    plusOneGuest: { deleteMany: vi.fn(), createMany: vi.fn() },
    rSVPAnswer: { upsert: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    invitation: { findUnique: vi.fn(), updateMany: vi.fn() },
    checkIn: { deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/eventAccess", () => ({ resolveEventAccess: async () => ({ decision: "granted" }) }));
vi.mock("@/lib/notifications/service", () => ({
  notifyRsvp: vi.fn().mockResolvedValue(undefined),
  notifyHostAlert: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));

const baseFields = [
  { id: "q-phone", fieldType: "PHONE", required: false, goingOnly: true, options: null },
  { id: "q-addr", fieldType: "ADDRESS", required: true, goingOnly: true, options: null },
  { id: "q-terms", fieldType: "TERMS", required: true, goingOnly: true, options: null },
  { id: "q-diet", fieldType: "TEXT", required: false, goingOnly: false, options: null },
];

function makeEvent(rsvpFields = baseFields) {
  return {
    id: "evt-1",
    slug: "party",
    title: "Party",
    status: "PUBLISHED",
    rsvpEnabled: true,
    visibility: "PUBLIC",
    passwordHash: null,
    hostId: "host-1",
    approvalRequired: false,
    rsvpDeadline: null,
    allowEditAfterDeadline: false,
    capacity: null,
    plusOneAllowed: false,
    plusOneMax: 0,
    plusOneNamesRequired: false,
    maybeEnabled: true,
    startAt: new Date("2099-01-01"),
    endAt: null,
    timezone: "UTC",
    locationType: "PHYSICAL",
    locationName: null,
    locationAddress: null,
    virtualUrl: null,
    theme: null,
    hostAlertEmail: false,
    hostAlertSms: false,
    host: { name: "Host", email: null, phone: null, preferredLocale: null },
    coHosts: [],
    rsvpFields,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.$executeRaw).mockResolvedValue(1);
  vi.mocked(db.event.findUnique).mockResolvedValue(makeEvent() as never);
  vi.mocked(db.rSVP.count).mockResolvedValue(0);
  vi.mocked(db.rSVP.create).mockResolvedValue({
    id: "rsvp-1",
    editToken: "tok-1",
    guestName: "Alice",
    status: "GOING",
    plusOneCount: 0,
    note: null,
  } as never);
  vi.mocked(db.rSVP.update).mockResolvedValue({} as never);
});

describe("RSVP questionnaire typed fields & goingOnly enforcement (#786)", () => {
  it("saves PHONE, ADDRESS, and TERMS for GOING without triggering SMS verification or User creation", async () => {
    const res = await createGuestRsvp(
      AddRsvpSchema.parse({
        eventId: "evt-1",
        guestName: "Alice",
        status: "GOING",
        plusOneCount: 0,
        answers: {
          "q-phone": "+1 555 234 5678",
          "q-addr": JSON.stringify({
            line1: " 10 Downing St ",
            city: " London ",
            postalCode: " SW1A 2AA ",
          }),
          "q-terms": TERMS_ACCEPTED_VALUE,
        },
      })
    );

    expect(res).toMatchObject({ success: true, id: "rsvp-1" });
    expect(db.user.upsert).not.toHaveBeenCalled();
    expect(db.rSVP.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          guestPhone: undefined,
        }),
      })
    );
    expect(db.rSVPAnswer.createMany).toHaveBeenCalledWith({
      data: [
        { rsvpId: "rsvp-1", rsvpFieldId: "q-phone", value: "+1 555 234 5678" },
        {
          rsvpId: "rsvp-1",
          rsvpFieldId: "q-addr",
          value: JSON.stringify({ line1: "10 Downing St", city: "London", postalCode: "SW1A 2AA" }),
        },
        { rsvpId: "rsvp-1", rsvpFieldId: "q-terms", value: TERMS_ACCEPTED_VALUE },
      ],
    });
  });

  it("rejects incomplete ADDRESS, invalid PHONE, and unaccepted required TERMS for GOING", async () => {
    expect(
      await createGuestRsvp(
        AddRsvpSchema.parse({
          eventId: "evt-1",
          guestName: "Alice",
          status: "GOING",
          answers: {
            "q-phone": "not-a-phone",
            "q-addr": JSON.stringify({
              line1: "10 Downing St",
              city: "London",
              postalCode: "SW1A",
            }),
            "q-terms": TERMS_ACCEPTED_VALUE,
          },
        })
      )
    ).toEqual({ success: false, reason: "invalidPhone" });

    expect(
      await createGuestRsvp(
        AddRsvpSchema.parse({
          eventId: "evt-1",
          guestName: "Alice",
          status: "GOING",
          answers: {
            "q-addr": JSON.stringify({ line1: "10 Downing St", city: "", postalCode: "SW1A" }),
            "q-terms": TERMS_ACCEPTED_VALUE,
          },
        })
      )
    ).toEqual({ success: false, reason: "addressIncomplete" });

    expect(
      await createGuestRsvp(
        AddRsvpSchema.parse({
          eventId: "evt-1",
          guestName: "Alice",
          status: "GOING",
          answers: {
            "q-addr": JSON.stringify({
              line1: "10 Downing St",
              city: "London",
              postalCode: "SW1A",
            }),
          },
        })
      )
    ).toEqual({ success: false, reason: "termsRequired" });

    expect(db.rSVP.create).not.toHaveBeenCalled();
  });

  it("skips required goingOnly fields when RSVPing MAYBE and clears them on status switch away from GOING", async () => {
    const maybeRes = await createGuestRsvp(
      AddRsvpSchema.parse({
        eventId: "evt-1",
        guestName: "Bob",
        status: "MAYBE",
        answers: {
          "q-diet": "Vegan",
          "q-phone": "+1 555 234 5678",
        },
      })
    );
    expect(maybeRes).toMatchObject({ success: true });
    expect(db.rSVPAnswer.createMany).toHaveBeenCalledWith({
      data: [{ rsvpId: "rsvp-1", rsvpFieldId: "q-diet", value: "Vegan" }],
    });

    vi.mocked(db.rSVP.findUnique).mockResolvedValue({
      id: "rsvp-1",
      editToken: "tok-1",
      eventId: "evt-1",
      guestName: "Alice",
      status: "GOING",
      responded: true,
      approved: true,
      plusOneCount: 0,
      plusOneGuests: [],
      note: null,
      checkIn: null,
      user: null,
      event: makeEvent(),
    } as never);

    const switchRes = await updateGuestRsvp(
      "tok-1",
      UpdateRsvpSchema.parse({
        status: "MAYBE",
        answers: { "q-diet": "Vegetarian" },
      })
    );
    expect(switchRes).toMatchObject({ success: true });
    expect(db.rSVPAnswer.deleteMany).toHaveBeenCalledWith({
      where: { rsvpId: "rsvp-1", rsvpFieldId: { in: ["q-phone", "q-addr", "q-terms"] } },
    });
    expect(db.rSVPAnswer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { rsvpId: "rsvp-1", rsvpFieldId: "q-diet", value: "Vegetarian" },
      })
    );
  });

  it("exempts signed SMS invitation replies from questionnaire required checks and preserves existing answers", async () => {
    vi.mocked(db.rSVP.findUnique).mockResolvedValue({
      id: "rsvp-1",
      editToken: "tok-1",
      eventId: "evt-1",
      guestName: "Alice",
      guestPhone: "+15551234567",
      status: "INVITED",
      responded: false,
      approved: true,
      plusOneCount: 0,
      plusOneGuests: [],
      note: null,
      checkIn: null,
      user: null,
      event: makeEvent(),
    } as never);
    vi.mocked(db.invitation.findUnique).mockResolvedValue({
      id: "inv-1",
      eventId: "evt-1",
      rsvpId: "rsvp-1",
      channel: "SMS",
      sentTo: "+15551234567",
    } as never);

    const res = await updateGuestRsvp(
      "tok-1",
      UpdateRsvpSchema.parse({ status: "GOING", plusOneCount: 0 }),
      { phone: "+15551234567", invitationId: "inv-1" }
    );
    expect(res).toMatchObject({ success: true });
    expect(db.rSVPAnswer.deleteMany).not.toHaveBeenCalled();
  });
});
