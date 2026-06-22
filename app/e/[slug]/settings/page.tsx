import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SettingsPage } from "@/components/event/SettingsPage";
import { getActiveThemePresets } from "@/app/actions/event";

export async function generateMetadata(props: PageProps<"/e/[slug]/settings">): Promise<Metadata> {
  const { slug } = await props.params;
  const event = await db.event.findUnique({ where: { slug }, select: { title: true } });
  if (!event) return {};
  return { title: `Settings – ${event.title}` };
}

export default async function EventSettingsRoute(props: PageProps<"/e/[slug]/settings">) {
  const { slug } = await props.params;

  const session = await getSession();
  if (!session) redirect(`/auth/sign-in?next=/e/${slug}/settings`);

  const event = await db.event.findUnique({
    where: { slug },
    include: {
      theme: true,
      reminderSettings: true,
      coHosts: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { id: "asc" },
      },
      rsvpFields: { orderBy: { order: "asc" } },
      potluckItems: {
        include: {
          claims: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      polls: {
        orderBy: { createdAt: "asc" },
        include: {
          options: {
            orderBy: { createdAt: "asc" },
            include: {
              votes: {
                select: {
                  id: true,
                  voterName: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!event) notFound();

  // allow cohosts to access settings too
  const isOwner = event.hostId === session.userId;
  const isCohost = event.coHosts.some((ch) => ch.user.id === session.userId);
  if (!isOwner && !isCohost) redirect(`/e/${slug}`);

  const themePresets = await getActiveThemePresets();

  return <SettingsPage event={event as Parameters<typeof SettingsPage>[0]["event"]} isOwner={isOwner} themePresets={themePresets} />;
}
