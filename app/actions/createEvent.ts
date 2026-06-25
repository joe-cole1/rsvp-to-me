"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession, destroySession } from "@/lib/session";
import { generateUniqueSlug } from "@/lib/slug";
import { tzLocalToUtc } from "@/lib/utils";
import { CreateEventSchema } from "@/lib/schemas";

export async function createEvent(formData: FormData) {
  const session = await getSession();
  if (!session || session.role === "GUEST") throw new Error("Unauthorized");

  const userExists = await db.user.findUnique({ where: { id: session.userId } });
  if (!userExists) {
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
  };

  const parsed = CreateEventSchema.parse(rawInput);

  const startAt = tzLocalToUtc(`${parsed.startDate}T${parsed.startTime}`, parsed.timezone);
  const slug = await generateUniqueSlug(parsed.title);

  const event = await db.event.create({
    data: {
      title: parsed.title,
      description: parsed.description,
      slug,
      startAt,
      timezone: parsed.timezone,
      locationType: parsed.locationType,
      locationName: parsed.locationName,
      locationAddress: parsed.locationAddress,
      virtualUrl: parsed.virtualUrl,
      visibility: parsed.visibility,
      hostId: session.userId,
      status: "PUBLISHED",
    },
  });

  redirect(`/e/${event.slug}`);
}
