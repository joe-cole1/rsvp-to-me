"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logActivity, iconLabel } from "@/lib/activity";
import { logSafe } from "@/lib/logger";
import { HttpUrlSchema } from "@/lib/schemas";
import { assertHostOrCohost } from "./shared";

// ── Info sections ──────────────────────────────────────────────────────────────

// SEC-36: section links render into guest-facing <a href>; only http(s) URLs
// may be persisted (blocks javascript:/data: URIs from a malicious host).
function parseSectionUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return HttpUrlSchema.parse(url);
}

export async function addInfoSection(data: {
  eventId: string;
  type: string;
  title: string | null;
  content: string;
  url: string | null;
  order: number;
}) {
  const event = await assertHostOrCohost(data.eventId);
  const section = await db.eventInfoSection.create({
    data: {
      eventId: data.eventId,
      type: data.type,
      title: data.title,
      content: data.content,
      url: parseSectionUrl(data.url),
      order: data.order,
    },
  });
  const preview = data.content.slice(0, 60) + (data.content.length > 60 ? "…" : "");
  const activityEvent = await logActivity(
    data.eventId,
    "info_add",
    `Added ${iconLabel(data.type)} section: ${preview}`
  ).catch(logSafe("addInfoSection"));
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: section.id, activityEvent };
}

export async function updateInfoSection(
  sectionId: string,
  data: { type?: string; title?: string | null; content: string; url: string | null }
) {
  const section = await db.eventInfoSection.findUnique({
    where: { id: sectionId },
    include: { event: { select: { slug: true } } },
  });
  if (!section) throw new Error("Forbidden");
  await assertHostOrCohost(section.eventId);
  await db.eventInfoSection.update({
    where: { id: sectionId },
    data: {
      ...(data.type !== undefined && { type: data.type }),
      ...(data.title !== undefined && { title: data.title }),
      content: data.content,
      url: parseSectionUrl(data.url),
    },
  });
  const editPreview = data.content.slice(0, 60) + (data.content.length > 60 ? "…" : "");
  logActivity(
    section.eventId,
    "info_edit",
    `Updated ${iconLabel(data.type ?? section.type)} section: ${editPreview}`
  ).catch(logSafe("updateInfoSection"));
  revalidatePath(`/e/${section.event.slug}`);
  return { success: true };
}

export async function removeInfoSection(sectionId: string) {
  const section = await db.eventInfoSection.findUnique({
    where: { id: sectionId },
    include: { event: { select: { slug: true } } },
  });
  if (!section) throw new Error("Forbidden");
  await assertHostOrCohost(section.eventId);
  await db.eventInfoSection.delete({ where: { id: sectionId } });
  const activityEvent = await logActivity(
    section.eventId,
    "info_delete",
    `Removed ${iconLabel(section.type)} section`
  ).catch(logSafe("removeInfoSection"));
  revalidatePath(`/e/${section.event.slug}`);
  return { activityEvent };
}

export async function reorderInfoSections(eventId: string, orderedSectionIds: string[]) {
  const event = await assertHostOrCohost(eventId);
  await db.$transaction(
    orderedSectionIds.map((id, index) =>
      db.eventInfoSection.update({
        where: { id },
        data: { order: index },
      })
    )
  );
  revalidatePath(`/e/${event.slug}`);
  return { success: true };
}
