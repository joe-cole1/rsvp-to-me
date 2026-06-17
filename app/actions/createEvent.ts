"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { generateUniqueSlug } from "@/lib/slug";
import { tzLocalToUtc } from "@/lib/utils";

export async function createEvent(formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "GUEST") throw new Error("Unauthorized");

  const title = formData.get("title") as string;
  const description = formData.get("description") as string | null;
  const startDate = formData.get("startDate") as string;
  const startTime = formData.get("startTime") as string;
  const timezone = formData.get("timezone") as string || "America/New_York";
  const locationType = formData.get("locationType") as string || "PHYSICAL";
  const locationName = formData.get("locationName") as string | null;
  const locationAddress = formData.get("locationAddress") as string | null;
  const virtualUrl = formData.get("virtualUrl") as string | null;
  const visibility = (formData.get("visibility") as string || "UNLISTED") as "PUBLIC" | "UNLISTED" | "PRIVATE";

  if (!title || !startDate || !startTime) throw new Error("Missing required fields");

  const startAt = tzLocalToUtc(`${startDate}T${startTime}`, timezone);
  const slug = await generateUniqueSlug(title);

  const event = await db.event.create({
    data: {
      title,
      description: description || null,
      slug,
      startAt,
      timezone,
      locationType: (["PHYSICAL", "VIRTUAL", "TBD"].includes(locationType) ? locationType : "PHYSICAL") as "PHYSICAL" | "VIRTUAL" | "TBD",
      locationName: locationName || null,
      locationAddress: locationAddress || null,
      virtualUrl: virtualUrl || null,
      visibility,
      hostId: session.userId,
      status: "PUBLISHED",
    },
  });

  redirect(`/e/${event.slug}`);
}
