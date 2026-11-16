"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertHostOrCohost } from "@/lib/auth-guards";
import { assertCaptcha } from "@/lib/captcha";
import { generateRandomSlug } from "@/lib/slug";
import { readUrlCode, signUrlCode } from "@/lib/event-url-proof";
import {
  EventSlugSchema,
  SaveEventUrlSchema,
  retainsRandomCode,
  type SaveEventUrlInput,
  type SaveEventUrlResult,
} from "@/lib/event-url-shared";

export async function previewEventUrl(
  eventId: string,
  prefix: string,
  captchaToken?: string | null
) {
  await assertHostOrCohost(eventId);
  await assertCaptcha("event_settings", captchaToken);
  const parsed = z.union([z.literal(""), EventSlugSchema.max(50)]).parse(prefix);
  const { slug, code } = await generateRandomSlug(parsed);
  return { slug, code, proof: signUrlCode(eventId, code) };
}

export async function saveEventUrl(
  eventId: string,
  input: SaveEventUrlInput,
  captchaToken?: string | null
): Promise<SaveEventUrlResult> {
  await assertHostOrCohost(eventId);
  await assertCaptcha("event_settings", captchaToken);
  const parsed = SaveEventUrlSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid" };
  const data = parsed.data;
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { slug: true, visibility: true, slugRandomCode: true },
  });
  if (!event || event.slug !== data.expectedSlug || event.visibility !== data.expectedVisibility)
    return { success: false, error: "stale" };

  const proposedCode = readUrlCode(eventId, data.generatedProof);
  const randomCode = retainsRandomCode(data.slug, proposedCode)
    ? proposedCode
    : retainsRandomCode(data.slug, event.slugRandomCode)
      ? event.slugRandomCode
      : null;
  if (data.visibility === "UNLISTED" && !randomCode && !data.allowGuessable)
    return { success: false, error: "confirmGuessable" };
  if (data.slug !== event.slug && !data.confirmLinkChange)
    return { success: false, error: "confirmChange" };

  try {
    // Compare-and-set keeps a stale settings tab from overwriting a concurrent
    // URL/visibility decision; the database's unique index arbitrates collisions.
    const result = await db.event.updateMany({
      where: {
        id: eventId,
        slug: event.slug,
        visibility: event.visibility,
        slugRandomCode: event.slugRandomCode,
      },
      data: { slug: data.slug, slugRandomCode: randomCode, visibility: data.visibility },
    });
    if (!result.count) return { success: false, error: "stale" };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002")
      return { success: false, error: "taken" };
    throw error;
  }

  // Invalidate the complete old and new route trees, including RSVP, calendar
  // and image routes. Deliberately create no redirect from the retired address.
  revalidatePath(`/e/${event.slug}`, "layout");
  if (data.slug !== event.slug) revalidatePath(`/e/${data.slug}`, "layout");
  revalidatePath("/", "layout");
  return { success: true, slug: data.slug, visibility: data.visibility, randomCode };
}
