import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { resolveTheme } from "@/lib/theme";
import { RsvpFlow } from "@/components/rsvp/RsvpFlow";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; status?: string; return?: string }>;
};

export default async function RsvpPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { token, status, return: returnTo } = await searchParams;

  const event = await db.event.findUnique({
    where: { slug },
    include: {
      theme: true,
      rsvpFields: { orderBy: { order: "asc" } },
    },
  });

  if (!event || event.status === "CANCELLED") notFound();

  const theme = resolveTheme(
    event.theme?.baseTheme ?? "DARK",
    event.theme?.accentColor ?? "#a855f7"
  );

  // Edit flow — token provided
  if (token) {
    const rsvp = await db.rSVP.findUnique({
      where: { editToken: token },
      include: {
        plusOneGuests: { orderBy: { order: "asc" } },
        answers: true,
      },
    });
    if (!rsvp || rsvp.eventId !== event.id) notFound();

    return (
      <RsvpFlow
        event={{
          id: event.id,
          slug: event.slug,
          title: event.title,
          startAt: event.startAt,
          endAt: event.endAt,
          timezone: event.timezone,
          locationName: event.locationName,
          plusOneAllowed: event.plusOneAllowed,
          plusOneMax: event.plusOneMax,
          maybeEnabled: event.maybeEnabled,
          questionnaireEnabled: event.questionnaireEnabled,
          rsvpFields: event.rsvpFields,
        }}
        theme={theme}
        existingRsvp={{
          id: rsvp.id,
          editToken: rsvp.editToken,
          guestName: rsvp.guestName,
          status: rsvp.status as "GOING" | "MAYBE" | "NO",
          plusOneCount: rsvp.plusOneCount,
          note: rsvp.note,
          plusOneGuests: rsvp.plusOneGuests,
          answers: rsvp.answers.map((a) => ({ rsvpFieldId: a.rsvpFieldId, value: a.value })),
        }}
        returnPath={returnTo === "guests" ? `/e/${slug}/guests` : undefined}
      />
    );
  }

  // New RSVP flow — status from URL
  const validStatuses = ["GOING", "MAYBE", "NO"] as const;
  const initialStatus = validStatuses.find((s) => s === status?.toUpperCase());
  if (!initialStatus) redirect(`/e/${slug}`);

  return (
    <RsvpFlow
      event={{
        id: event.id,
        slug: event.slug,
        title: event.title,
        startAt: event.startAt,
        endAt: event.endAt,
        timezone: event.timezone,
        locationName: event.locationName,
        plusOneAllowed: event.plusOneAllowed,
        plusOneMax: event.plusOneMax,
        maybeEnabled: event.maybeEnabled,
        questionnaireEnabled: event.questionnaireEnabled,
        rsvpFields: event.rsvpFields,
      }}
      theme={theme}
      initialStatus={initialStatus}
    />
  );
}
