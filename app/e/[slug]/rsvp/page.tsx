import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session-user";
import { resolveEventAccess } from "@/lib/eventAccess";
import { resolveTheme } from "@/lib/theme";
import { RsvpFlow } from "@/components/rsvp/RsvpFlow";
import { getChannelConfig } from "@/lib/config";
import { resolveEffectConfig } from "@/lib/effects";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; status?: string; return?: string }>;
};

export default async function RsvpPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { token, status, return: returnTo } = await searchParams;

  const [sessionUser, channelConfig] = await Promise.all([getSessionUser(), getChannelConfig()]);

  const validStatuses = ["GOING", "MAYBE", "NO"] as const;
  const initialStatus = validStatuses.find((s) => s === status?.toUpperCase());

  const event = await db.event.findUnique({
    where: { slug },
    include: {
      theme: true,
      coHosts: { select: { userId: true } },
      rsvpFields: { orderBy: { order: "asc" } },
      polls: {
        orderBy: { createdAt: "asc" },
        include: { options: { orderBy: { createdAt: "asc" } } },
      },
      potluckItems: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!event || event.status === "CANCELLED" || event.status === "DELETED") notFound();

  // Gate RSVPs after deadline
  const isOrganizer =
    !!sessionUser &&
    (sessionUser.role === "ADMIN" ||
      event.hostId === sessionUser.id ||
      event.coHosts.some((ch) => ch.userId === sessionUser.id));

  const deadline = event.rsvpDeadline ? new Date(event.rsvpDeadline) : null;
  const now = new Date();
  const deadlinePassed = deadline ? deadline < now : false;
  const eventStarted = event.startAt <= now;

  if (eventStarted && !isOrganizer && !token) redirect(`/e/${slug}`);

  if (deadlinePassed && !eventStarted && !isOrganizer) {
    const isEditAllowed = !!token && event.allowEditAfterDeadline;
    if (!isEditAllowed) {
      redirect(`/e/${slug}`);
    }
  }

  // Enforce the visibility/password gate before rendering the RSVP flow — a
  // valid token, host session, or unlock cookie is required for PRIVATE or
  // password-protected events. New guests reach public events normally.
  const { decision } = await resolveEventAccess(event, slug, { token });
  if (decision !== "granted") redirect(`/e/${slug}`);

  const theme = resolveTheme(
    event.theme?.baseTheme ?? "DARK",
    event.theme?.gradientFrom ?? "#7c3aed",
    event.theme?.gradientTo ?? "#1e40af",
    event.theme?.accentColor ?? "#a855f7",
    event.theme?.cardOpacity,
    event.theme?.fontId
  );
  const effect = resolveEffectConfig(event.theme);

  const rsvpEvent = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    startAt: event.startAt,
    endAt: event.endAt,
    timezone: event.timezone,
    locationName: event.locationName,
    plusOneAllowed: event.plusOneAllowed,
    plusOneMax: event.plusOneMax,
    plusOneNamesRequired: event.plusOneNamesRequired,
    maybeEnabled: event.maybeEnabled,
    questionnaireEnabled: event.questionnaireEnabled,
    rsvpFields: event.rsvpFields,
    polls: event.polls,
    potluckItems: event.potluckItems,
  };

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
        event={rsvpEvent}
        theme={theme}
        effect={effect}
        existingRsvp={{
          id: rsvp.id,
          editToken: rsvp.editToken,
          guestName: rsvp.guestName,
          status: (rsvp.status === "INVITED" ? "GOING" : rsvp.status) as "GOING" | "MAYBE" | "NO",
          plusOneCount: rsvp.plusOneCount,
          note: rsvp.note,
          plusOneGuests: rsvp.plusOneGuests,
          answers: rsvp.answers.map((a) => ({ rsvpFieldId: a.rsvpFieldId, value: a.value })),
        }}
        initialStatus={initialStatus}
        returnPath={returnTo === "guests" ? `/e/${slug}/guests` : undefined}
        sessionUser={sessionUser}
        channelConfig={channelConfig}
        organizerOverride={isOrganizer}
        readOnlyReason={
          eventStarted && !isOrganizer
            ? "This event has started, so guests can no longer change their RSVP. Contact the host if your response needs to be updated."
            : undefined
        }
      />
    );
  }

  // New RSVP flow — status from URL
  if (!initialStatus) redirect(`/e/${slug}`);

  return (
    <RsvpFlow
      event={rsvpEvent}
      theme={theme}
      effect={effect}
      initialStatus={initialStatus}
      sessionUser={sessionUser}
      channelConfig={channelConfig}
    />
  );
}
