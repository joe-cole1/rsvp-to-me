import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/ui/AppShell";
import { APP_SHELL } from "@/lib/theme";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <AppShell center>
      <div style={{ textAlign: "center", maxWidth: "480px" }}>
        <div style={{ fontSize: "64px", marginBottom: "24px" }}>🎉</div>
        <h1
          style={{
            fontSize: "48px",
            fontWeight: 900,
            marginBottom: "12px",
            background: `linear-gradient(135deg, ${APP_SHELL.accent}, ${APP_SHELL.accentSecondary})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          RSVP
        </h1>
        <p style={{ fontSize: "18px", color: APP_SHELL.textSecondary, marginBottom: "40px", lineHeight: 1.6 }}>
          Beautiful, personal event pages for wine nights, dinner parties, and everything in between.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href="/auth/sign-in"
            style={{
              padding: "14px 32px",
              background: APP_SHELL.accent,
              color: APP_SHELL.textPrimary,
              borderRadius: APP_SHELL.btnRadius,
              textDecoration: "none",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            Sign in
          </a>
          <a
            href="/auth/register"
            style={{
              padding: "14px 32px",
              background: APP_SHELL.cardBg2,
              border: `1px solid ${APP_SHELL.cardBorder}`,
              color: APP_SHELL.textPrimary,
              borderRadius: APP_SHELL.btnRadius,
              textDecoration: "none",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            Create account
          </a>
        </div>
      </div>
    </AppShell>
  );
}
