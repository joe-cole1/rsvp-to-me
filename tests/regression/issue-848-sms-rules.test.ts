// #848 root cause: Twilio wrote RSVPs independently and trusted stale invitation
// links. Signed replies must use the shared service and current matching contact.
import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { updateGuestRsvp } from "@/lib/rsvp-service";
import { POST } from "@/app/api/webhooks/twilio/route";
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "inv" }]),
    user: { findUnique: vi.fn() },
    invitation: { findMany: vi.fn() },
    rSVP: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/sms", () => ({ resolveTwilioAuthToken: async () => "fixture-token" }));
vi.mock("@/lib/rsvp-service", () => ({ updateGuestRsvp: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
function request(body = "YES", from = "+15551234567") {
  const url = "http://localhost:3000/api/webhooks/twilio";
  const params = new URLSearchParams({ From: from, Body: body });
  const canonical = [...params.keys()].sort().reduce((s, k) => s + k + params.get(k), url);
  const signature = crypto.createHmac("sha1", "fixture-token").update(canonical).digest("base64");
  return new NextRequest(url, {
    method: "POST",
    headers: { "x-twilio-signature": signature },
    body: params.toString(),
  });
}
const invitation = {
  id: "inv",
  eventId: "event",
  rsvpId: "rsvp",
  sentTo: "5551234567",
  event: { title: "Party", slug: "party" },
};
const rsvp = {
  editToken: "private",
  eventId: "event",
  guestPhone: "(555) 123-4567",
  status: "INVITED",
  responded: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.user.findUnique).mockResolvedValue(null);
  vi.mocked(db.invitation.findMany).mockResolvedValue([invitation] as never);
  vi.mocked(db.rSVP.findUnique).mockResolvedValue(rsvp as never);
  vi.mocked(updateGuestRsvp).mockResolvedValue({ success: true, rsvpId: "rsvp", slug: "party" });
});
describe("#848: signed SMS reply routing", () => {
  it.each(["YES", "NO", "MAYBE"])(
    "routes %s through the shared service with verified proof",
    async (body) => {
      expect((await POST(request(body))).status).toBe(200);
      expect(updateGuestRsvp).toHaveBeenCalledWith(
        "private",
        { status: { YES: "GOING", NO: "NO", MAYBE: "MAYBE" }[body], plusOneCount: 0 },
        { phone: "+15551234567", invitationId: "inv" }
      );
      expect(db.$queryRaw).toHaveBeenCalledWith(expect.anything(), [
        "+15551234567",
        "15551234567",
        "5551234567",
      ]);
    }
  );
  it.each([
    { guestPhone: "+15559999999" },
    { eventId: "other" },
    { status: "GOING", responded: true },
  ])("rejects a stale or answered invitation: %j", async (override) => {
    vi.mocked(db.rSVP.findUnique).mockResolvedValue({ ...rsvp, ...override } as never);
    const xml = await (await POST(request())).text();
    expect(xml).toContain("No pending invitations");
    expect(xml).not.toContain("private");
    expect(updateGuestRsvp).not.toHaveBeenCalled();
  });
  it("deduplicates resend history for one RSVP", async () => {
    vi.mocked(db.invitation.findMany).mockResolvedValue([
      invitation,
      { ...invitation, id: "resend" },
    ] as never);
    expect(await (await POST(request())).text()).toContain("Party");
    expect(updateGuestRsvp).toHaveBeenCalledOnce();
  });
  it("offers only verified links for genuinely different pending invitations", async () => {
    vi.mocked(db.invitation.findMany).mockResolvedValue([
      invitation,
      { ...invitation, id: "inv2", rsvpId: "rsvp2" },
    ] as never);
    expect(await (await POST(request())).text()).toContain("2 pending invitations");
    expect(updateGuestRsvp).not.toHaveBeenCalled();
  });
  it.each([
    ["atCapacity", "full"],
    ["maybeDisabled", "doesn"],
    ["eventStarted", "closed"],
    ["deadlinePassed", "closed"],
    ["forbidden", "No pending"],
  ] as const)("surfaces shared-service rejection %s", async (reason, text) => {
    vi.mocked(updateGuestRsvp).mockResolvedValue({ success: false, reason });
    expect(await (await POST(request())).text()).toContain(text);
  });
  it("never performs lookups or writes on an invalid signature", async () => {
    const req = request();
    req.headers.set("x-twilio-signature", "bad");
    expect((await POST(req)).status).toBe(403);
    expect(db.invitation.findMany).not.toHaveBeenCalled();
    expect(updateGuestRsvp).not.toHaveBeenCalled();
  });
});
