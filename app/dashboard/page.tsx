import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getDashboardEvents, getDashboardActivity } from "@/app/actions/event";
import { AppShell } from "@/components/ui/AppShell";
import { AppNavLogo } from "@/components/ui/AppNav";
import { APP_SHELL } from "@/lib/theme";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session || session.role === "GUEST") redirect("/auth/sign-in");

  const userExists = await db.user.findUnique({ where: { id: session.userId } });
  if (!userExists) {
    redirect("/auth/sign-out");
  }

  const events = await getDashboardEvents();
  const eventIds = events.map(e => e.id);
  const recentActivities = await getDashboardActivity(eventIds);
  const userName = userExists.name || userExists.email?.split("@")[0] || "Host";

  return (
    <AppShell>
      <AppNavLogo
        href="/dashboard"
        trailing={
          <a href="/auth/sign-out" style={{ fontSize: "13px", color: APP_SHELL.textMuted, textDecoration: "none" }}>
            Sign out
          </a>
        }
      />
      <DashboardClient
        initialEvents={events}
        recentActivities={recentActivities}
        userName={userName}
      />
    </AppShell>
  );
}
