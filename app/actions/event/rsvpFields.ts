"use server";

import { eventActionMessage } from "./localization";

import { revalidatePath } from "next/cache";
import {
  PollVoterNameSchema,
  RsvpFieldSchema,
  SubmitQuestionnaireSchema,
  TermsConfigSchema,
  UpdateRsvpFieldSchema,
} from "@/lib/schemas";
import { db } from "@/lib/db";
import { assertHostOrCohost } from "./shared";
import { assertCaptcha } from "@/lib/captcha";
import { getSession } from "@/lib/session";
import { resolveEventAccess } from "@/lib/eventAccess";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp, isTrustedIpConfigured } from "@/lib/clientIp";
import { getOrCreatePollVoterTokenHash } from "@/lib/poll-voter-token";
import {
  parseTermsFieldConfig,
  serializeTermsFieldConfig,
  validateRsvpFieldAnswer,
  type RsvpFieldTypeValue,
} from "@/lib/rsvp-fields";

// ── RSVP Fields ───────────────────────────────────────────────────────────────

async function normalizeTermsOptions(
  rawOptions: string | null | undefined
): Promise<string | null> {
  if (!rawOptions || !rawOptions.trim()) return null;
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawOptions);
  } catch {
    const config = parseTermsFieldConfig(rawOptions);
    return serializeTermsFieldConfig(config);
  }
  const checked = TermsConfigSchema.safeParse(parsedJson);
  if (!checked.success) {
    throw new Error(await eventActionMessage("invalidTermsUrl"));
  }
  return serializeTermsFieldConfig(checked.data);
}

export async function addRsvpField(
  eventId: string,
  data: {
    label: string;
    description?: string | null;
    fieldType: RsvpFieldTypeValue;
    required: boolean;
    goingOnly?: boolean;
    options?: string | null;
    order: number;
  },
  captchaToken?: string | null
) {
  const parsed = RsvpFieldSchema.parse(data);
  const event = await assertHostOrCohost(eventId);
  await assertCaptcha("rsvp_field", captchaToken);
  const options =
    parsed.fieldType === "TERMS"
      ? await normalizeTermsOptions(parsed.options)
      : parsed.fieldType === "SELECT" || parsed.fieldType === "CHECKBOX"
        ? (parsed.options ?? null)
        : null;
  const field = await db.rSVPField.create({
    data: {
      eventId,
      label: parsed.label,
      description: parsed.description ? parsed.description : null,
      fieldType: parsed.fieldType,
      required: parsed.required,
      goingOnly: parsed.goingOnly ?? false,
      options,
      order: parsed.order,
    },
  });
  revalidatePath(`/e/${event.slug}/settings`);
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: field.id };
}

export async function updateRsvpField(
  fieldId: string,
  data: {
    label?: string;
    description?: string | null;
    required?: boolean;
    goingOnly?: boolean;
    options?: string | null;
    fieldType?: RsvpFieldTypeValue;
  },
  captchaToken?: string | null
) {
  const parsed = UpdateRsvpFieldSchema.parse(data);
  const field = await db.rSVPField.findUnique({
    where: { id: fieldId },
    include: { event: { select: { slug: true } } },
  });
  if (!field) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(field.eventId);
  await assertCaptcha("rsvp_field", captchaToken);
  const effectiveType = parsed.fieldType ?? field.fieldType;
  let nextOptions: string | null | undefined = undefined;
  if (parsed.options !== undefined) {
    nextOptions =
      effectiveType === "TERMS"
        ? await normalizeTermsOptions(parsed.options)
        : parsed.options || null;
  }
  await db.rSVPField.update({
    where: { id: fieldId },
    data: {
      ...(parsed.label !== undefined && { label: parsed.label }),
      ...(parsed.description !== undefined && { description: parsed.description || null }),
      ...(parsed.required !== undefined && { required: parsed.required }),
      ...(parsed.goingOnly !== undefined && { goingOnly: parsed.goingOnly }),
      ...(nextOptions !== undefined && { options: nextOptions }),
      ...(parsed.fieldType !== undefined && {
        fieldType: parsed.fieldType,
      }),
    },
  });
  revalidatePath(`/e/${field.event.slug}/settings`);
  revalidatePath(`/e/${field.event.slug}`);
  return { success: true };
}

export async function deleteRsvpField(fieldId: string) {
  const field = await db.rSVPField.findUnique({
    where: { id: fieldId },
    include: { event: { select: { slug: true } } },
  });
  if (!field) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(field.eventId);
  await db.rSVPField.delete({ where: { id: fieldId } });
  revalidatePath(`/e/${field.event.slug}/settings`);
  revalidatePath(`/e/${field.event.slug}`);
}

export async function reorderRsvpFields(eventId: string, orderedIds: string[]) {
  const event = await assertHostOrCohost(eventId);

  // SEC-2: verify every supplied ID belongs to this event before touching the DB
  if (orderedIds.length > 0) {
    const ownedFields = await db.rSVPField.findMany({
      where: { eventId },
      select: { id: true },
    });
    const ownedSet = new Set(ownedFields.map((f) => f.id));
    if (!orderedIds.every((id) => ownedSet.has(id))) {
      throw new Error(await eventActionMessage("fieldOwnership"));
    }
  }

  await Promise.all(
    orderedIds.map((id, index) => db.rSVPField.update({ where: { id }, data: { order: index } }))
  );
  revalidatePath(`/e/${event.slug}/settings`);
  revalidatePath(`/e/${event.slug}`);
}

export async function getRsvpFieldAnswers(fieldId: string) {
  const field = await db.rSVPField.findUnique({
    where: { id: fieldId },
    include: {
      answers: { include: { rsvp: { select: { guestName: true } } }, orderBy: { id: "asc" } },
    },
  });
  if (!field) throw new Error(await eventActionMessage("forbidden"));
  await assertHostOrCohost(field.eventId);
  return field.answers.map((a: { value: string; rsvp: { guestName: string } }) => ({
    guestName: a.rsvp.guestName,
    value: a.value,
  }));
}

export async function submitQuestionnaireResponse(rawInput: unknown, captchaToken?: string | null) {
  const parsed = SubmitQuestionnaireSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false as const, error: await eventActionMessage("checkQuestionnaireFields") };
  }
  const data = parsed.data;
  await assertCaptcha("questionnaire_submit", captchaToken);

  const event = await db.event.findUnique({
    where: { id: data.eventId },
    select: {
      id: true,
      slug: true,
      status: true,
      visibility: true,
      passwordHash: true,
      hostId: true,
      rsvpEnabled: true,
      coHosts: { select: { userId: true } },
      rsvpFields: { orderBy: { order: "asc" } },
    },
  });
  if (
    !event ||
    event.status !== "PUBLISHED" ||
    event.rsvpEnabled !== false ||
    event.rsvpFields.length === 0
  ) {
    return { success: false as const, error: await eventActionMessage("forbidden") };
  }

  const access = await resolveEventAccess(event, event.slug);
  if (access.decision !== "granted") {
    return { success: false as const, error: await eventActionMessage("forbidden") };
  }

  const rlKey = isTrustedIpConfigured()
    ? `questionnaire:${event.id}:${await getClientIp()}`
    : `questionnaire:${event.id}:shared`;
  const rl = await rateLimit(rlKey, isTrustedIpConfigured() ? 20 : 80, 600);
  if (!rl.success) {
    return {
      success: false as const,
      error: await eventActionMessage("questionnaireRateLimited"),
    };
  }

  const session = await getSession();
  let userId: string | null = null;
  let voterTokenHash: string | null = null;
  let respondentName: string;

  if (session?.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    const candidateName = user?.name?.trim() || data.respondentName.trim() || user?.email || "";
    const parsedName = PollVoterNameSchema.safeParse(candidateName);
    if (!parsedName.success) {
      return {
        success: false as const,
        error: await eventActionMessage("questionnaireNameRequired"),
        fieldErrors: { respondentName: await eventActionMessage("questionnaireNameRequired") },
      };
    }
    respondentName = parsedName.data;
    userId = session.userId;
  } else {
    const parsedName = PollVoterNameSchema.safeParse(data.respondentName);
    if (!parsedName.success) {
      return {
        success: false as const,
        error: await eventActionMessage("questionnaireNameRequired"),
        fieldErrors: { respondentName: await eventActionMessage("questionnaireNameRequired") },
      };
    }
    respondentName = parsedName.data;
    voterTokenHash = await getOrCreatePollVoterTokenHash();
  }

  const fieldErrors: Record<string, string> = {};
  const normalizedAnswers: Record<string, string> = {};

  for (const field of event.rsvpFields) {
    const validated = validateRsvpFieldAnswer(field, data.answers[field.id]);
    if (!validated.valid) {
      fieldErrors[field.id] = await eventActionMessage(validated.reason);
      continue;
    }
    if (validated.normalized !== null) {
      normalizedAnswers[field.id] = validated.normalized;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false as const,
      error: await eventActionMessage("checkQuestionnaireFields"),
      fieldErrors,
    };
  }

  const submission = await db.$transaction(async (tx) => {
    const existing = userId
      ? await tx.questionnaireSubmission.findUnique({
          where: { eventId_userId: { eventId: event.id, userId } },
          select: { id: true },
        })
      : await tx.questionnaireSubmission.findUnique({
          where: { eventId_voterTokenHash: { eventId: event.id, voterTokenHash: voterTokenHash! } },
          select: { id: true },
        });

    const record = existing
      ? await tx.questionnaireSubmission.update({
          where: { id: existing.id },
          data: { respondentName },
        })
      : await tx.questionnaireSubmission.create({
          data: {
            eventId: event.id,
            userId,
            voterTokenHash,
            respondentName,
          },
        });

    await tx.questionnaireAnswer.deleteMany({ where: { submissionId: record.id } });
    const entries = Object.entries(normalizedAnswers);
    if (entries.length > 0) {
      await tx.questionnaireAnswer.createMany({
        data: entries.map(([rsvpFieldId, value]) => ({
          submissionId: record.id,
          rsvpFieldId,
          value,
        })),
      });
    }
    return record;
  });

  revalidatePath(`/e/${event.slug}`);
  revalidatePath(`/e/${event.slug}/settings`);
  return {
    success: true as const,
    respondentName: submission.respondentName,
    updatedAt: submission.updatedAt.toISOString(),
    answers: normalizedAnswers,
  };
}
