import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };
import { db } from "@/lib/db";
import { getDashboardEvents, getDashboardActivity, getDashboardInvites } from "@/app/actions/event";
import { isOpenRegistrationActive } from "@/lib/auth";
import { AppShell } from "@/components/ui/AppShell";
import { AppNavLogo } from "@/components/ui/AppNav";
import ProfileDropdown from "@/components/ui/ProfileDropdown";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/auth/sign-in");

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
  const invites = await getDashboardInvites();
  const openRegistration = await isOpenRegistrationActive();

  const eventIds = [...events.map(e => e.id), ...invites.map(i => i.id)];
  const recentActivities = await getDashboardActivity(eventIds);
  
  const userName = userExists.name || userExists.email?.split("@")[0] || "User";

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
        initialInvites={invites}
        recentActivities={recentActivities}
        userName={userName}
        userRole={userExists.role as "GUEST" | "HOST" | "ADMIN"}
        openRegistration={openRegistration}
      />
    </AppShell>
  );
}
