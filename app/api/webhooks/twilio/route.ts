import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw;
}

function validateTwilioSignature(req: NextRequest, body: string): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  const url = `${APP_URL}/api/webhooks/twilio`;
  const signature = req.headers.get("x-twilio-signature") ?? "";

  const params = new URLSearchParams(body);
  const sortedKeys = [...params.keys()].sort();
  const canonical = sortedKeys.reduce((acc, key) => acc + key + (params.get(key) ?? ""), url);

  const expected = crypto.createHmac("sha1", authToken).update(canonical).digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function twiml(message: string): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  );
}

const STATUS_MAP: Record<string, "GOING" | "MAYBE" | "NO"> = {
  YES: "GOING",
  NO: "NO",
  MAYBE: "MAYBE",
};

type PendingInvitation = {
  rsvpId: string;
  editToken: string;
  eventTitle: string;
  eventSlug: string;
  rsvpDeadline: Date | null;
  maybeEnabled: boolean;
  capacity: number | null;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();

  if (!validateTwilioSignature(req, body)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const params = new URLSearchParams(body);
  const from = params.get("From") ?? "";
  const rawBody = (params.get("Body") ?? "").trim().toUpperCase();

  const newStatus = STATUS_MAP[rawBody];
  if (!newStatus) {
    return twiml("Reply YES, NO, or MAYBE to update your RSVP.");
  }

  const phone = normalizePhone(from);

  // Find invitations for this phone where the linked RSVP is still INVITED
  const invitations = await db.invitation.findMany({
    where: { sentTo: phone, channel: "SMS", rsvpId: { not: null } },
    include: {
      event: {
        select: {
          title: true,
          slug: true,
          rsvpDeadline: true,
          maybeEnabled: true,
          capacity: true,
        },
      },
    },
  });

  const pending: PendingInvitation[] = [];
  for (const inv of invitations) {
    if (!inv.rsvpId) continue;
    const rsvp = await db.rSVP.findUnique({
      where: { id: inv.rsvpId },
      select: { editToken: true, status: true },
    });
    if (rsvp?.status === "INVITED") {
      pending.push({
        rsvpId: inv.rsvpId,
        editToken: rsvp.editToken,
        eventTitle: inv.event.title,
        eventSlug: inv.event.slug,
        rsvpDeadline: inv.event.rsvpDeadline,
        maybeEnabled: inv.event.maybeEnabled,
        capacity: inv.event.capacity,
      });
    }
  }

  if (pending.length === 0) {
    return twiml("No pending invitations found for this number.");
  }

  if (pending.length > 1) {
    const lines = pending
      .map((p) => `• ${p.eventTitle}: ${APP_URL}/e/${p.eventSlug}/rsvp?token=${p.editToken}`)
      .join("\n");
    return twiml(`You have ${pending.length} pending invitations. RSVP at each link:\n${lines}`);
  }

  const p = pending[0];

  if (p.rsvpDeadline && p.rsvpDeadline < new Date()) {
    return twiml(`Sorry, RSVPs are closed for ${p.eventTitle}.`);
  }

  if (newStatus === "MAYBE" && !p.maybeEnabled) {
    return twiml(`${p.eventTitle} doesn't allow a "maybe" response. Reply YES or NO.`);
  }

  if (newStatus === "GOING" && p.capacity) {
    const goingCount = await db.rSVP.count({
      where: {
        event: { slug: p.eventSlug },
        status: "GOING",
        approved: true,
        responded: true,
      },
    });
    if (goingCount >= p.capacity) {
      return twiml(`Sorry, ${p.eventTitle} is full. You can still reply MAYBE if you'd like to be waitlisted.`);
    }
  }

  await db.rSVP.update({
    where: { id: p.rsvpId },
    data: { status: newStatus, responded: true },
  });

  const statusLabel = newStatus === "GOING" ? "going" : newStatus === "MAYBE" ? "maybe" : "not going";
  const editUrl = `${APP_URL}/e/${p.eventSlug}/rsvp?token=${p.editToken}`;
  return twiml(`Got it! You're ${statusLabel} for ${p.eventTitle}. Update anytime: ${editUrl}`);
}
