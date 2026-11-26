import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";
import type { AddRsvpSchema, UpdateRsvpSchema } from "@/lib/schemas";
import type { sendRsvpConfirmationEmail, sendHostRsvpAlertEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { withEventCapacityLock } from "@/lib/capacityLock";
import { resolveEventAccess } from "@/lib/eventAccess";
import { normalizePhone, matchesSmsPhone } from "@/lib/phone";
import { resolveLocale } from "@/i18n/config";
import { notifyRsvp, notifyHostAlert } from "@/lib/notifications/service";
import { logActivity } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { readRsvpContactProofs, rsvpContacts } from "@/lib/rsvp-contact-proof";
import { resolveInvitationRecipients } from "@/lib/invitation-recipients";
import { isFieldVisibleForRsvpStatus, validateRsvpFieldAnswer } from "@/lib/rsvp-fields";

type AddInput = z.output<typeof AddRsvpSchema>;
type UpdateInput = z.output<typeof UpdateRsvpSchema>;
export type RsvpFailure =
  | "eventNotFound"
  | "forbidden"
  | "rsvpsDisabled"
  | "eventStarted"
  | "deadlinePassed"
  | "invalidRsvp"
  | "maybeDisabled"
  | "atCapacity"
  | "rsvpNotFound"
  | "rsvpProofRequired"
  | "rsvpUsePrivateLink"
  | "invalidPhone"
  | "addressIncomplete"
  | "termsRequired"
  | "questionnaireFieldRequired"
  | "questionnaireInvalidOption";
const failure = (reason: RsvpFailure) => ({ success: false as const, reason });

const eventSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  rsvpEnabled: true,
  visibility: true,
  passwordHash: true,
  hostId: true,
  approvalRequired: true,
  rsvpDeadline: true,
  allowEditAfterDeadline: true,
  capacity: true,
  plusOneAllowed: true,
  plusOneMax: true,
  plusOneNamesRequired: true,
  maybeEnabled: true,
  startAt: true,
  endAt: true,
  timezone: true,
  locationType: true,
  locationName: true,
  locationAddress: true,
  virtualUrl: true,
  theme: true,
  hostAlertEmail: true,
  hostAlertSms: true,
  host: { select: { name: true, email: true, phone: true, preferredLocale: true } },
  coHosts: {
    select: { userId: true, user: { select: { email: true, phone: true, preferredLocale: true } } },
  },
  rsvpFields: {
    select: { id: true, fieldType: true, required: true, goingOnly: true, options: true },
  },
} satisfies Prisma.EventSelect;
type RsvpEvent = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

function validateRules(
  event: RsvpEvent,
  data: UpdateInput,
  editing: boolean,
  isSmsReply = false
): RsvpFailure | null {
  const now = new Date();
  if (event.status !== "PUBLISHED") return "forbidden";
  if (event.rsvpEnabled === false) return "rsvpsDisabled";
  if (event.startAt <= now) return "eventStarted";
  // Keep the existing late-decline exception; new responses still close at the deadline.
  if (
    event.rsvpDeadline &&
    event.rsvpDeadline < now &&
    !(editing && (event.allowEditAfterDeadline || data.status === "NO"))
  )
    return "deadlinePassed";
  if (data.status === "MAYBE" && !event.maybeEnabled) return "maybeDisabled";
  if (data.status === "GOING") {
    if (data.plusOneCount > (event.plusOneAllowed ? event.plusOneMax : 0)) return "invalidRsvp";
    const names = data.plusOneGuestNames;
    if (names && names.length > data.plusOneCount) return "invalidRsvp";
    if (
      event.plusOneNamesRequired &&
      data.plusOneCount > 0 &&
      (!names || names.length !== data.plusOneCount || names.some((name) => !name.trim()))
    )
      return "invalidRsvp";
  }
  if (!isSmsReply) {
    for (const field of event.rsvpFields ?? []) {
      if (!isFieldVisibleForRsvpStatus(field, data.status)) continue;
      const result = validateRsvpFieldAnswer(field, data.answers?.[field.id]);
      if (!result.valid) return result.reason;
    }
  }
  return null;
}

async function saveAnswers(
  tx: Prisma.TransactionClient,
  rsvpId: string,
  event: RsvpEvent,
  data: UpdateInput,
  creating = false,
  isSmsReply = false
) {
  if (isSmsReply && data.answers === undefined) return;
  const rsvpFields = event.rsvpFields ?? [];
  const fieldById = new Map(rsvpFields.map((f) => [f.id, f]));
  if (creating) {
    const rows: { rsvpId: string; rsvpFieldId: string; value: string }[] = [];
    for (const [rsvpFieldId, rawValue] of Object.entries(data.answers ?? {})) {
      const field = fieldById.get(rsvpFieldId);
      if (!field || !isFieldVisibleForRsvpStatus(field, data.status)) continue;
      const validated = validateRsvpFieldAnswer(field, rawValue);
      if (validated.valid && validated.normalized !== null) {
        rows.push({ rsvpId, rsvpFieldId, value: validated.normalized });
      }
    }
    if (rows.length) {
      await tx.rSVPAnswer.createMany({ data: rows });
    }
    return;
  }

  const idsToDelete: string[] = [];
  for (const field of rsvpFields) {
    if (!isFieldVisibleForRsvpStatus(field, data.status)) {
      idsToDelete.push(field.id);
      continue;
    }
    if (!data.answers || !(field.id in data.answers)) continue;
    const validated = validateRsvpFieldAnswer(field, data.answers[field.id]);
    if (!validated.valid) continue;
    if (validated.normalized === null) {
      idsToDelete.push(field.id);
    } else {
      await tx.rSVPAnswer.upsert({
        where: { rsvpId_rsvpFieldId: { rsvpId, rsvpFieldId: field.id } },
        create: { rsvpId, rsvpFieldId: field.id, value: validated.normalized },
        update: { value: validated.normalized },
      });
    }
  }
  if (idsToDelete.length > 0 && typeof tx.rSVPAnswer.deleteMany === "function") {
    await tx.rSVPAnswer.deleteMany({
      where: { rsvpId, rsvpFieldId: { in: idsToDelete } },
    });
  }
}

async function savePlusOnes(
  tx: Prisma.TransactionClient,
  rsvpId: string,
  data: UpdateInput,
  replacing = true
) {
  // Replace atomically, including clearing stale names on a decline or smaller party.
  if (replacing) await tx.plusOneGuest.deleteMany({ where: { rsvpId } });
  if (data.status === "GOING" && data.plusOneGuestNames?.length) {
    await tx.plusOneGuest.createMany({
      data: data.plusOneGuestNames
        .slice(0, data.plusOneCount)
        .map((name, order) => ({ rsvpId, name: name.trim(), order }))
        .filter((g) => g.name),
    });
  }
}

type RsvpAlertRecipient = {
  email: string | null;
  phone: string | null;
  preferredLocale: string | null;
};

// Host "New RSVP" alerts — fire-and-forget so a notification failure never
// blocks the guest's RSVP. Per-event toggles gate each channel; the email
// alert is intentionally immune to the guest email_enabled channel toggle
// (see Guest Messaging Channel Toggles, PR #181) while the SMS alert stays
// behind sms_enabled inside sendHostRsvpAlertSms.
function sendHostRsvpAlerts(
  event: {
    id: string;
    title: string;
    slug: string;
    theme: Parameters<typeof sendHostRsvpAlertEmail>[1]["theme"];
    hostAlertEmail: boolean;
    hostAlertSms: boolean;
    host: RsvpAlertRecipient;
    coHosts: { user: RsvpAlertRecipient }[];
  },
  alert: {
    guestName: string;
    status: "GOING" | "MAYBE" | "NO";
    plusOneCount: number;
    note: string | null;
  },
  source: string
) {
  if (!event.hostAlertEmail && !event.hostAlertSms) return;
  const alertBase = { ...alert, eventTitle: event.title, eventSlug: event.slug };
  (async () => {
    const counts = await db.rSVP.groupBy({
      by: ["status"],
      where: { eventId: event.id, status: { in: ["GOING", "MAYBE", "NO"] } },
      _count: { _all: true },
    });
    const countFor = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;
    // One dispatcher call resolves all current organizers and their own preferences.
    await notifyHostAlert(event.id, {
      kind: "host_alert",
      id: event.id,
      options: {
        ...alertBase,
        goingCount: countFor("GOING"),
        maybeCount: countFor("MAYBE"),
        noCount: countFor("NO"),
        theme: event.theme,
      },
    });
  })().catch(logSafe(source));
}

/** Guest RSVP confirmation (with the edit link) to each contact the RSVP has. */
function sendRsvpConfirmations(
  rsvpId: string,
  opts: Parameters<typeof sendRsvpConfirmationEmail>[1],
  source: string
) {
  void notifyRsvp(rsvpId, { kind: "confirmation", id: rsvpId, options: opts }).catch(
    logSafe(source)
  );
}

function notifyResponse(
  event: RsvpEvent,
  rsvp: {
    id: string;
    editToken: string;
    guestName: string;
    status: "GOING" | "MAYBE" | "NO";
    plusOneCount: number;
    note: string | null;
  },
  locale: string | null | undefined,
  firstResponse: boolean
) {
  const statusText =
    rsvp.status === "GOING" ? "going" : rsvp.status === "MAYBE" ? "maybe" : "not going";
  const plusStr = rsvp.plusOneCount > 0 ? ` +${rsvp.plusOneCount}` : "";
  const detail = firstResponse
    ? `${rsvp.guestName} is ${statusText}${plusStr}${rsvp.note?.trim() ? `\n${rsvp.note.trim()}` : ""}`
    : `${rsvp.guestName} updated to ${statusText}`;
  logActivity(event.id, firstResponse ? "rsvp_new" : "rsvp_update", detail, rsvp.guestName).catch(
    logSafe("guestRSVP")
  );
  if (!firstResponse) return;
  sendRsvpConfirmations(
    rsvp.id,
    {
      locale: resolveLocale(locale),
      guestName: rsvp.guestName,
      eventTitle: event.title,
      eventSlug: event.slug,
      eventId: event.id,
      status: rsvp.status,
      editToken: rsvp.editToken,
      startAt: event.startAt,
      endAt: event.endAt,
      timezone: event.timezone,
      locationType: event.locationType,
      locationName: event.locationName,
      locationAddress: event.locationAddress,
      virtualUrl: event.virtualUrl,
      theme: event.theme,
      replyTo: event.host.email || undefined,
    },
    "guestRSVP"
  );
  sendHostRsvpAlerts(
    event,
    {
      guestName: rsvp.guestName,
      status: rsvp.status,
      plusOneCount: rsvp.plusOneCount,
      note: rsvp.note,
    },
    "guestRSVP"
  );
}

/** Parsed public-form input only; callers enforce CAPTCHA and delivery rate limits. */
export async function createGuestRsvp(input: AddInput, contactProofs?: unknown) {
  const data = {
    ...input,
    guestPhone: input.guestPhone ? normalizePhone(input.guestPhone) : input.guestPhone,
    plusOneCount: input.status === "GOING" ? input.plusOneCount : 0,
  };
  const result = await withEventCapacityLock(data.eventId, async (tx) => {
    const event = await tx.event.findUnique({ where: { id: data.eventId }, select: eventSelect });
    if (!event) return failure("eventNotFound");
    if ((await resolveEventAccess(event, event.slug)).decision !== "granted")
      return failure("forbidden");
    const invalid = validateRules(event, data, false);
    if (invalid) return failure(invalid);
    if (
      event.capacity &&
      data.status === "GOING" &&
      (await tx.rSVP.count({ where: { eventId: event.id, status: "GOING", approved: true } })) >=
        event.capacity
    )
      return failure("atCapacity");

    const proofIds = await readRsvpContactProofs(tx, event.id, data, contactProofs);
    if (!proofIds) return failure("rsvpProofRequired");
    const contacts = rsvpContacts(data);
    // Share the invitation/contact-change locks. Account ids and historical
    // delivery records never substitute for the current, proved RSVP contact.
    for (const contact of contacts.map((item) => item.destination).sort())
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"invitation:" + event.id}), hashtext(${contact}))`;
    const resolved = contacts.length
      ? await resolveInvitationRecipients(
          event.id,
          contacts.map((item) => ({ contact: item.destination })),
          data.guestName,
          tx
        )
      : [];
    if (
      resolved.some(
        (item) =>
          item.preview.disposition === "conflict" || item.preview.disposition === "responded"
      )
    )
      return failure("rsvpUsePrivateLink");
    const matches = resolved.flatMap((item) => (item.rsvp ? [item.rsvp] : []));
    if (new Set(matches.map((row) => row.id)).size > 1) return failure("rsvpUsePrivateLink");
    const invited = matches[0];
    let user: { id: string; preferredLocale: string | null } | null = null;
    if (!invited && (data.guestEmail || data.guestPhone)) {
      const contact = data.guestEmail ? { email: data.guestEmail } : { phone: data.guestPhone! };
      user = await tx.user.upsert({
        where: contact,
        create: { ...contact, name: data.guestName },
        update: {},
        select: { id: true, preferredLocale: true },
      });
    }
    const fields = {
      guestName: data.guestName,
      status: data.status,
      plusOneCount: data.plusOneCount,
      note: data.note || null,
      approved: !event.approvalRequired,
      responded: true,
    };
    const rsvp = invited
      ? await tx.rSVP.update({ where: { id: invited.id }, data: fields })
      : await tx.rSVP.create({
          data: {
            ...fields,
            eventId: event.id,
            guestEmail: data.guestEmail,
            guestPhone: data.guestPhone,
            userId: user?.id,
          },
        });
    await saveAnswers(tx, rsvp.id, event, data, !invited);
    await savePlusOnes(tx, rsvp.id, data, !!invited);
    if (contacts.length) {
      await tx.invitation.updateMany({
        where: {
          eventId: event.id,
          rsvpId: null,
          OR: contacts.map((contact) =>
            contact.channel === "email"
              ? {
                  channel: "EMAIL",
                  sentTo: { equals: contact.destination, mode: "insensitive" as const },
                }
              : { channel: "SMS", sentTo: contact.destination }
          ),
        },
        data: { rsvpId: rsvp.id },
      });
      await tx.rsvpContactChallenge.updateMany({
        where: { id: { in: proofIds } },
        data: { usedAt: new Date() },
      });
    }
    return {
      success: true as const,
      event,
      rsvp,
      fields,
      invited: !!invited,
      locale: user?.preferredLocale,
    };
  });
  if (!result.success) return result;
  notifyResponse(result.event, { ...result.rsvp, ...result.fields }, result.locale, true);
  return {
    success: true as const,
    id: result.rsvp.id,
    editToken: result.rsvp.editToken,
    slug: result.event.slug,
  };
}

/**
 * Only the signed webhook supplies smsProof. It is not a Server Action argument.
 * Verify invitation history against current event/contact state inside the lock.
 */
export async function updateGuestRsvp(
  editToken: string,
  input: UpdateInput,
  smsProof?: { phone: string; invitationId: string }
) {
  const initial = await db.rSVP.findUnique({ where: { editToken }, select: { eventId: true } });
  if (!initial) return failure("rsvpNotFound");
  const result = await withEventCapacityLock(initial.eventId, async (tx) => {
    const rsvp = await tx.rSVP.findUnique({
      where: { editToken },
      include: {
        checkIn: { select: { id: true } },
        user: { select: { preferredLocale: true } },
        plusOneGuests: { orderBy: { order: "asc" } },
        event: { select: eventSelect },
      },
    });
    if (!rsvp || rsvp.eventId !== initial.eventId) return failure("rsvpNotFound");
    if (smsProof) {
      const invitation = await tx.invitation.findUnique({ where: { id: smsProof.invitationId } });
      if (
        !invitation ||
        invitation.channel !== "SMS" ||
        invitation.rsvpId !== rsvp.id ||
        invitation.eventId !== rsvp.eventId ||
        !matchesSmsPhone(invitation.sentTo, smsProof.phone) ||
        !matchesSmsPhone(rsvp.guestPhone, smsProof.phone) ||
        rsvp.status !== "INVITED" ||
        rsvp.responded
      )
        return failure("forbidden");
    }
    const data = {
      ...input,
      plusOneCount: input.status === "GOING" ? input.plusOneCount : 0,
      plusOneGuestNames:
        input.plusOneGuestNames ??
        rsvp.plusOneGuests.map((g) => g.name).slice(0, input.plusOneCount),
    };
    const invalid = validateRules(rsvp.event, data, true, Boolean(smsProof));
    if (invalid) return failure(invalid);
    if (
      rsvp.event.capacity &&
      data.status === "GOING" &&
      rsvp.status !== "GOING" &&
      (await tx.rSVP.count({
        where: { eventId: rsvp.eventId, status: "GOING", approved: true },
      })) >= rsvp.event.capacity
    )
      return failure("atCapacity");
    const firstResponse = !rsvp.responded;
    const fields = {
      status: data.status,
      ...(data.guestName !== undefined && { guestName: data.guestName }),
      plusOneCount: data.plusOneCount,
      responded: true,
      ...(data.note !== undefined && { note: data.note || null }),
      ...(firstResponse && { approved: !rsvp.event.approvalRequired }),
    };
    await tx.rSVP.update({ where: { editToken }, data: fields });
    await savePlusOnes(tx, rsvp.id, data);
    await saveAnswers(tx, rsvp.id, rsvp.event, data, false, Boolean(smsProof));
    if (data.status === "NO" && rsvp.checkIn) {
      await tx.checkIn.deleteMany({ where: { rsvpId: rsvp.id, eventId: rsvp.eventId } });
    }
    return { success: true as const, rsvp, fields, firstResponse };
  });
  if (!result.success) return result;
  const { rsvp, fields, firstResponse } = result;
  const saved = { ...rsvp, ...fields };
  if (fields.status === "NO" && rsvp.checkIn) {
    logActivity(
      rsvp.eventId,
      "check_in_undo",
      `automatically undid check-in for ${saved.guestName} after an RSVP status change`,
      saved.guestName
    ).catch(logSafe("guestRSVP"));
  }
  notifyResponse(rsvp.event, saved, rsvp.user?.preferredLocale, firstResponse);
  return { success: true as const, rsvpId: rsvp.id, slug: rsvp.event.slug };
}
