import { getEditorIconSummaries } from "@/lib/editor-icon-summaries";
import { getRequestTranslator } from "@/i18n/server";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session-user";
import { SettingsPage } from "@/components/event/SettingsPage";
import { getActiveThemePresets } from "@/app/actions/event";
import { getChannelConfig } from "@/lib/config";
import { CUSTOM_EFFECT_ID } from "@/lib/effects";

export async function generateMetadata(props: PageProps<"/e/[slug]/settings">): Promise<Metadata> {
  const { slug } = await props.params;
  const event = await db.event.findUnique({ where: { slug }, select: { title: true } });
  if (!event) return {};
  const translate = await getRequestTranslator();
  return { title: translate("Ui.Event.SettingsRoute.metadata", { title: event.title }) };
}

export default async function EventSettingsRoute(props: PageProps<"/e/[slug]/settings">) {
  const { slug } = await props.params;

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect(`/auth/sign-in?next=/e/${slug}/settings`);

  const event = await db.event.findUnique({
    where: { slug },
    include: {
      host: { select: { id: true, name: true, email: true } },
      theme: true,
      reminderSettings: true,
      coHosts: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { id: "asc" },
      },
      coHostInvitations: {
        orderBy: { createdAt: "asc" },
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

  // Owners, co-hosts and moderating admins. The stored role decides — never a URL flag —
  // matching the settings actions' assertHost/assertHostOrCohost guards. Admins get the
  // co-host view: owner-only controls (danger zone, co-host management) stay hidden.
  const isOwner = event.hostId === sessionUser.id;
  const isCohost = event.coHosts.some((ch) => ch.user.id === sessionUser.id);
  const isAdminModerating = sessionUser.role === "ADMIN" && !isOwner && !isCohost;
  if (!isOwner && !isCohost && !isAdminModerating) redirect(`/e/${slug}`);

  // #825: seed labels for only the stored mixture's icons (never the catalog).
  const storedIconIds =
    event.theme?.effectId === CUSTOM_EFFECT_ID ? (event.theme.effectIconIds ?? []) : [];
  const [themePresets, channelConfig] = await Promise.all([
    getActiveThemePresets(),
    getChannelConfig(),
  ]);

  // Preset default mixtures load into the editor, so their labels are seeded too.
  const initialLibraryIcons = await getEditorIconSummaries(storedIconIds, themePresets);

  return (
    <SettingsPage
      event={event as Parameters<typeof SettingsPage>[0]["event"]}
      isOwner={isOwner}
      adminModerating={isAdminModerating}
      themePresets={themePresets}
      sessionUser={sessionUser}
      channelConfig={channelConfig}
      initialLibraryIcons={initialLibraryIcons}
    />
  );
}
