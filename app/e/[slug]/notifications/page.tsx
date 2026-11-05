import { notFound } from "next/navigation";
import { getRequestTranslator } from "@/i18n/server";
import { readManagement } from "@/lib/notifications/manage";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { APP_SHELL_THEME } from "@/lib/theme";
import { InlineAlert } from "@/components/ui/AppPrimitives";
import { AppShell } from "@/components/ui/AppShell";
import { buildStyles } from "@/components/event/settings-page/styles";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function NotificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; rsvpId?: string }>;
}) {
  const { slug } = await params;
  const { token, rsvpId } = await searchParams;
  const scope = {
    kind: "rsvp" as const,
    slug,
    ...(token ? { token } : {}),
    ...(rsvpId ? { rsvpId } : {}),
  };
  // The server read authorizes the page and seeds the editor, so it never shows stale or
  // editable controls before its data arrives.
  const data = await readManagement(scope).catch(() => null);
  if (!data) notFound();
  const t = await getRequestTranslator();
  return (
    <AppShell>
      <main style={buildStyles(APP_SHELL_THEME).container}>
        <InlineAlert tone="info">{t("Ui.Notifications.guestIntro")}</InlineAlert>
        <NotificationPreferences key={JSON.stringify(scope)} scope={scope} initialData={data} />
      </main>
    </AppShell>
  );
}
