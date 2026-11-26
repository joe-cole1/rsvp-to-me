"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession, destroySession } from "@/lib/session";
import { getSessionUser } from "@/lib/session-user";
import { generateUniqueSlug } from "@/lib/slug";
import { tzLocalToUtc } from "@/lib/utils";
import { CreateEventSchema } from "@/lib/schemas";
import { assertCaptcha } from "@/lib/captcha";
import { CAPTCHA_RESPONSE_FIELD } from "@/lib/captcha-types";

export async function createEvent(formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "GUEST") throw new Error("Unauthorized");

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    await destroySession();
    redirect("/auth/sign-in");
  }

  // Parse using Zod
  const rawInput = {
    title: formData.get("title") as string,
    description: formData.get("description") as string | null,
    startDate: formData.get("startDate") as string,
    startTime: formData.get("startTime") as string,
    timezone: (formData.get("timezone") as string) || "America/New_York",
    locationType: (formData.get("locationType") as string) || "PHYSICAL",
    locationName: formData.get("locationName") as string | null,
    locationAddress: formData.get("locationAddress") as string | null,
    virtualUrl: formData.get("virtualUrl") as string | null,
    visibility: (formData.get("visibility") as string) || "UNLISTED",
    rsvpEnabled: formData.get("rsvpEnabled") !== "false",
  };

  const parsed = CreateEventSchema.parse(rawInput);
  const captchaToken = formData.get(CAPTCHA_RESPONSE_FIELD);
  await assertCaptcha("event_create", typeof captchaToken === "string" ? captchaToken : null);

  const startAt = tzLocalToUtc(`${parsed.startDate}T${parsed.startTime}`, parsed.timezone);
  // A unique lookup cannot reserve a URL. Retry a racing insert as well.
  let event: { slug: string } | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = await generateUniqueSlug(parsed.title, parsed.visibility);
    try {
      event = await db.event.create({
        data: {
          title: parsed.title,
          description: parsed.description,
          slug,
          slugRandomCode: parsed.visibility === "PUBLIC" ? null : slug,
          startAt,
          timezone: parsed.timezone,
          locationType: parsed.locationType,
          locationName: parsed.locationName,
          locationAddress: parsed.locationAddress,
          virtualUrl: parsed.virtualUrl,
          visibility: parsed.visibility,
          rsvpEnabled: parsed.rsvpEnabled,
          hostId: sessionUser.id,
          status: "PUBLISHED",
          ...(parsed.rsvpEnabled
            ? {
                notificationSchedule: {
                  create: [
                    { kind: "reminder", hoursBefore: 24 },
                    { kind: "nudge", hoursBefore: 72 },
                  ],
                },
              }
            : {}),
        },
      });
      break;
    } catch (error) {
      if (
        attempt === 3 ||
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "P2002"
      )
        throw error;
    }
  }
  if (!event) throw new Error("Could not create event. Please try again.");

  redirect(`/e/${event.slug}`);
}
