import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session-user";
import { loadDocs } from "@/lib/docs";
import { AppShell } from "@/components/ui/AppShell";
import { APP_SHELL } from "@/lib/theme";
import DocsPanel from "@/components/docs/DocsPanel";

export const metadata = {
  title: "Help & Guides",
  description: "Guides for hosting events on RSVP to Me",
};

export default async function HelpPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role === "GUEST") redirect("/dashboard");

  const docs = await loadDocs("host");

  return (
    <AppShell>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 20px 60px" }}>
        <h1
          style={{
            fontSize: "26px",
            fontWeight: 800,
            color: APP_SHELL.textPrimary,
            margin: "0 0 24px",
          }}
        >
          📖 Help &amp; Guides
        </h1>
        <DocsPanel docs={docs} />
      </div>
    </AppShell>
  );
}
