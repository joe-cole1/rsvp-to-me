// Regression (01a1a105 QC, D3): the public RSVP form handed out an invited guest's link.
//
// Found: 2026-11-05 local QC. `addRSVP` merges a public submission into the INVITED RSVP of
// whoever owns the typed email and returned that RSVP's edit token. Anyone who knew an
// invitee's email could take the private link, and the new notification page then let them
// prove their own address and replace the invitee's contact, redirecting future messages.
// The merge now returns no token; the confirmation still reaches the invited contact.
// Follow-on: whether a public submission should merge into an invitation at all.
import "@/tests/helpers/english-request-locale";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ invited: vi.fn(), notify: vi.fn() }));
const event = {
  id: "event",
  slug: "party",
  title: "Party",
  approvalRequired: false,
  rsvpDeadline: null,
  capacity: null,
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
  host: { name: "Host", email: "host@example.com", phone: null, preferredLocale: null },
  coHosts: [],
  rsvpFields: [],
};
vi.mock("@/lib/db", () => ({
  db: {
    event: { findUnique: async () => event },
    user: { upsert: async () => ({ id: "invitee", preferredLocale: null }) },
    rSVP: {
      findFirst: m.invited,
      update: async () => ({ id: "invited", editToken: "invitee-private-token" }),
      create: async () => ({ id: "fresh", editToken: "fresh-token" }),
    },
    invitation: { updateMany: async () => ({ count: 0 }) },
    rSVPAnswer: { createMany: vi.fn() },
    plusOneGuest: { createMany: vi.fn() },
  },
}));
vi.mock("@/lib/captcha", () => ({ assertCaptcha: async () => undefined }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: async () => ({ success: true }) }));
vi.mock("@/lib/clientIp", () => ({ getClientIp: async () => "127.0.0.1" }));
vi.mock("@/lib/capacityLock", () => ({
  withEventCapacityLock: (_id: string, operation: () => unknown) => operation(),
}));
vi.mock("@/lib/activity", () => ({ logActivity: async () => undefined }));
vi.mock("@/lib/notifications/service", () => ({
  notifyRsvp: m.notify,
  notifyHostAlert: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { addRSVP } from "@/app/actions/event/rsvp";

const input = {
  eventId: "event",
  guestName: "Someone",
  guestEmail: "invitee@example.com",
  status: "GOING",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.notify.mockResolvedValue(undefined);
});

describe("public RSVP form and invitations", () => {
  it("never returns an invited guest's private link to whoever typed their contact", async () => {
    m.invited.mockResolvedValue({ id: "invited", status: "INVITED" });
    const result = await addRSVP(input);
    expect(result).toMatchObject({ success: true, editToken: null });
    expect(JSON.stringify(result)).not.toContain("invitee-private-token");
    // The private link still goes to the invited contact through the confirmation.
    expect(m.notify).toHaveBeenCalledWith(
      "invited",
      expect.objectContaining({ kind: "confirmation" })
    );
  });
  it("still returns the link to someone creating their own RSVP", async () => {
    m.invited.mockResolvedValue(null);
    expect(await addRSVP(input)).toMatchObject({ success: true, editToken: "fresh-token" });
  });
});
