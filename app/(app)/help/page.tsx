import { getRequestTranslator, getRequestLocale } from "@/i18n/server";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session-user";
import { loadDocs } from "@/lib/docs";
import { AppShell } from "@/components/ui/AppShell";
import { APP_SHELL_THEME } from "@/lib/theme";
import DocsPanel from "@/components/docs/DocsPanel";

export async function generateMetadata() {
  const tr = await getRequestTranslator();
  return {
    title: tr("Ui.Dashboard.helpMetadataTitle"),
    description: tr("Ui.Dashboard.helpMetadataDescription"),
  };
}

export default async function HelpPage() {
  const tr = await getRequestTranslator();
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role === "GUEST") redirect("/dashboard");

  const docs = await loadDocs("host", await getRequestLocale());

  return (
    <AppShell>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 20px 60px" }}>
        <h1
          style={{
            fontSize: "26px",
            fontWeight: 800,
            color: APP_SHELL_THEME.textPrimary,
            margin: "0 0 24px",
          }}
        >
          {tr("Ui.Dashboard.helpMetadataTitle")}
        </h1>
        <DocsPanel docs={docs} />
      </div>
    </AppShell>
  );
}
