import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveTheme } from "@/lib/theme";
import { EventPage } from "@/components/event/EventPage";

export default async function EventRoute(props: PageProps<"/e/[slug]">) {
  const { slug } = await props.params;

  const event = await db.event.findUnique({
    where: { slug },
    include: {
      host: { select: { id: true, name: true, email: true } },
      theme: true,
      infoSections: { orderBy: { order: "asc" } },
      rsvpFields: { orderBy: { order: "asc" } },
      rsvps: {
        where: { approved: true },
        select: {
          id: true,
          guestName: true,
          status: true,
          plusOneCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        where: { parentId: null },
        include: { replies: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!event || event.status === "CANCELLED") notFound();

  const session = await getSession();
  const isHost = session?.userId === event.hostId;

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
    />
  );
}
