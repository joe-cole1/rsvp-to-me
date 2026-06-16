import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SettingsPage } from "@/components/event/SettingsPage";

export default async function EventSettingsRoute(props: PageProps<"/e/[slug]/settings">) {
  const { slug } = await props.params;

  const session = await getSession();
  if (!session) redirect(`/auth/sign-in?next=/e/${slug}/settings`);

  const event = await db.event.findUnique({
    where: { slug },
    include: {
      theme: true,
      reminderSettings: true,
    },
  });

  if (!event) notFound();
  if (event.hostId !== session.userId) redirect(`/e/${slug}`);

  return <SettingsPage event={event as Parameters<typeof SettingsPage>[0]["event"]} />;
}
