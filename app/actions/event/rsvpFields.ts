"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertHostOrCohost } from "./shared";

// ── RSVP Fields ───────────────────────────────────────────────────────────────

export async function addRsvpField(
  eventId: string,
  data: {
    label: string;
    fieldType: "TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX";
    required: boolean;
    options?: string;
    order: number;
  }
) {
  const event = await assertHostOrCohost(eventId);
  const field = await db.rSVPField.create({
    data: {
      eventId,
      label: data.label,
      fieldType: data.fieldType,
      required: data.required,
      options: data.options ?? null,
      order: data.order,
    },
  });
  revalidatePath(`/e/${event.slug}/settings`);
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: field.id };
}

export async function updateRsvpField(
  fieldId: string,
  data: { label?: string; required?: boolean; options?: string; fieldType?: string }
) {
  const field = await db.rSVPField.findUnique({
    where: { id: fieldId },
    include: { event: { select: { slug: true } } },
  });
  if (!field) throw new Error("Forbidden");
  await assertHostOrCohost(field.eventId);
  await db.rSVPField.update({
    where: { id: fieldId },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.required !== undefined && { required: data.required }),
      ...(data.options !== undefined && { options: data.options || null }),
      ...(data.fieldType !== undefined && {
        fieldType: data.fieldType as "TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX",
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
  if (!field) throw new Error("Forbidden");
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
      throw new Error("Forbidden: one or more field IDs do not belong to this event");
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
  if (!field) throw new Error("Forbidden");
  await assertHostOrCohost(field.eventId);
  return field.answers.map((a: { value: string; rsvp: { guestName: string } }) => ({
    guestName: a.rsvp.guestName,
    value: a.value,
  }));
}
