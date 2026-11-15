import { resolveLocale } from "@/i18n/config";
import { getTranslator } from "@/i18n/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveTwilioAuthToken } from "@/lib/sms";
import crypto from "crypto";
import { normalizePhone, smsPhoneVariants, matchesSmsPhone } from "@/lib/phone";
import { updateGuestRsvp } from "@/lib/rsvp-service";
import { revalidatePath } from "next/cache";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// SEC-27: resolve the auth token from admin-panel config first, then env, via
// the shared helper in lib/sms. Previously this used process.env.TWILIO_AUTH_TOKEN
// only, so an admin-panel-only Twilio setup (no env var) rejected every inbound
// reply — silently breaking reply-to-RSVP even though outbound SMS worked.
async function validateTwilioSignature(req: NextRequest, body: string): Promise<boolean> {
  const authToken = await resolveTwilioAuthToken();
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

// SEC-11: neutralize XML metacharacters so user-controlled strings (event
// titles, guest names) cannot break out of the <Message> element and inject
// arbitrary TwiML into the response.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(message: string): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  );
}

const STATUS_MAP: Record<string, "GOING" | "MAYBE" | "NO"> = {
  YES: "GOING",
  NO: "NO",
  MAYBE: "MAYBE",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();

  if (!(await validateTwilioSignature(req, body))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const params = new URLSearchParams(body);
  const from = params.get("From") ?? "";
  const rawBody = (params.get("Body") ?? "").trim().toUpperCase();

  const phone = normalizePhone(from);
  const user = await db.user.findUnique({ where: { phone }, select: { preferredLocale: true } });
  const t = await getTranslator(resolveLocale(user?.preferredLocale));
  const newStatus = STATUS_MAP[rawBody];
  if (!newStatus) {
    return twiml(t("Sms.webhook.invalid"));
  }

  const variants = smsPhoneVariants(phone);
  // Historical destinations may still contain presentation punctuation. Match
  // them without rewriting account identities or guessing non-US countries.
  const matches = variants.length
    ? await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Invitation"
    WHERE channel = 'SMS' AND "rsvpId" IS NOT NULL
      AND regexp_replace("sentTo", '[[:space:]().-]', '', 'g') = ANY(${variants}::text[])
  `
    : [];
  const invitations = matches.length
    ? await db.invitation.findMany({
        where: {
          id: { in: matches.map((match) => match.id) },
          channel: "SMS",
          rsvpId: { not: null },
        },
        include: { event: { select: { title: true, slug: true } } },
      })
    : [];
  const pending = [];
  const seen = new Set<string>();
  for (const inv of invitations) {
    if (!inv.rsvpId || seen.has(inv.rsvpId)) continue;
    const rsvp = await db.rSVP.findUnique({
      where: { id: inv.rsvpId },
      select: {
        editToken: true,
        status: true,
        responded: true,
        eventId: true,
        guestPhone: true,
      },
    });
    // Historical links cannot reveal or exercise the current RSVP credential.
    if (
      rsvp?.status === "INVITED" &&
      !rsvp.responded &&
      rsvp.eventId === inv.eventId &&
      matchesSmsPhone(rsvp.guestPhone, phone) &&
      matchesSmsPhone(inv.sentTo, phone)
    ) {
      seen.add(inv.rsvpId);
      pending.push({
        invitationId: inv.id,
        editToken: rsvp.editToken,
        eventTitle: inv.event.title,
        eventSlug: inv.event.slug,
      });
    }
  }

  if (pending.length === 0) {
    return twiml(t("Sms.webhook.none"));
  }

  if (pending.length > 1) {
    const lines = pending
      .map((p) => `• ${p.eventTitle}: ${APP_URL}/e/${p.eventSlug}/rsvp?token=${p.editToken}`)
      .join("\n");
    return twiml(t("Sms.webhook.multiple", { count: pending.length, links: lines }));
  }

  const p = pending[0];

  const result = await updateGuestRsvp(
    p.editToken,
    { status: newStatus, plusOneCount: 0 },
    { phone, invitationId: p.invitationId }
  );
  if (!result.success) {
    const key =
      result.reason === "atCapacity"
        ? "full"
        : result.reason === "maybeDisabled"
          ? "noMaybe"
          : result.reason === "forbidden" || result.reason === "rsvpNotFound"
            ? "none"
            : "closed";
    return twiml(t(`Sms.webhook.${key}`, { eventTitle: p.eventTitle }));
  }
  revalidatePath(`/e/${result.slug}`);
  revalidatePath(`/e/${result.slug}/guests`);

  const statusLabel = t(`Sms.webhook.status.${newStatus}`);
  const editUrl = `${APP_URL}/e/${p.eventSlug}/rsvp?token=${p.editToken}`;
  return twiml(
    t("Sms.webhook.confirmed", { status: statusLabel, eventTitle: p.eventTitle, editUrl })
  );
}
