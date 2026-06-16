import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { resolveTheme } from "@/lib/theme";
import { RsvpEditForm } from "@/components/rsvp/RsvpEditForm";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function RsvpEditPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { token } = await searchParams;

  if (!token) notFound();

  const rsvp = await db.rSVP.findUnique({
    where: { editToken: token },
    include: {
      event: {
        include: {
          theme: true,
          host: { select: { name: true } },
        },
      },
    },
  });

  // Validate token belongs to this event slug
  if (!rsvp || rsvp.event.slug !== slug) notFound();

  const theme = resolveTheme(
    rsvp.event.theme?.baseTheme ?? "DARK",
    rsvp.event.theme?.accentColor ?? "#a855f7"
  );

  return (
    <RsvpEditForm
      rsvp={{
        editToken: rsvp.editToken,
        guestName: rsvp.guestName,
        status: rsvp.status,
        plusOneCount: rsvp.plusOneCount,
      }}
      event={{
        title: rsvp.event.title,
        slug: rsvp.event.slug,
        startAt: rsvp.event.startAt,
        locationName: rsvp.event.locationName,
        plusOneAllowed: rsvp.event.plusOneAllowed,
        plusOneMax: rsvp.event.plusOneMax,
      }}
      theme={theme}
    />
  );
}
