import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveTheme } from "@/lib/theme";
import { EventPage } from "@/components/event/EventPage";
import { PasswordGate } from "@/components/event/PasswordGate";

export default async function EventRoute(props: PageProps<"/e/[slug]">) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const isPreview = searchParams?.preview === "1";

  const event = await db.event.findUnique({
    where: { slug },
    include: {
      host: { select: { id: true, name: true, email: true } },
      theme: true,
      infoSections: { orderBy: { order: "asc" } },
      rsvpFields: { orderBy: { order: "asc" } },
      coHosts: { select: { userId: true } },
      rsvps: {
        where: { approved: true },
        select: {
          id: true,
          guestName: true,
          status: true,
          plusOneCount: true,
          note: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      updates: { orderBy: { createdAt: "desc" } },
      potluckItems: { orderBy: { createdAt: "asc" } },
      comments: {
        where: { parentId: null },
        include: { replies: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      activityEvents: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });

  if (!event || event.status === "CANCELLED") notFound();

  const session = await getSession();
  const isHostOwner = session?.userId === event.hostId;
  const isCohost = event.coHosts.some((ch) => ch.userId === session?.userId);
  const isHost = !isPreview && (isHostOwner || isCohost);

  // Password gate — hosts bypass it
  if (event.password && !isHost && searchParams?.pw !== event.password) {
    return <PasswordGate slug={slug} />;
  }

  const pendingRsvps = isHost
    ? await db.rSVP.findMany({
        where: { eventId: event.id, approved: false },
        select: { id: true, guestName: true, guestEmail: true, status: true, plusOneCount: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const theme = resolveTheme(
    event.theme?.baseTheme ?? "DARK",
    event.theme?.accentColor ?? "#a855f7"
  );

  return (
    <EventPage
      event={{ ...event, pendingRsvps } as Parameters<typeof EventPage>[0]["event"]}
      isHost={!!isHost}
      theme={theme}
      coverUploadEnabled={true}
    />
  );
}
