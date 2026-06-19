import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getDashboardEvents, getDashboardActivity } from "@/app/actions/event";
import { AppShell } from "@/components/ui/AppShell";
import { AppNavLogo } from "@/components/ui/AppNav";
import ProfileDropdown from "@/components/ui/ProfileDropdown";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session || session.role === "GUEST") redirect("/auth/sign-in");

  const userExists = await db.user.findUnique({ where: { id: session.userId } });
  if (!userExists) {
    redirect("/auth/sign-out");
  }

  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase().trim();
  if (initialAdminEmail && userExists.email?.toLowerCase().trim() === initialAdminEmail && userExists.role !== "ADMIN") {
    await db.user.update({
      where: { id: userExists.id },
      data: { role: "ADMIN" },
    });
    userExists.role = "ADMIN";
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
          <ProfileDropdown
            user={{
              name: userExists.name,
              email: userExists.email,
              role: userExists.role as "GUEST" | "HOST" | "ADMIN",
              avatarUrl: userExists.avatarUrl,
            }}
          />
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
