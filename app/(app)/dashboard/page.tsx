import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDashboardEvents, getDashboardActivity, getDashboardInvites } from "@/app/actions/event";
import { isOpenRegistrationActive } from "@/lib/auth";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getSessionUser } from "@/lib/session-user";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/auth/sign-in");

  const events = await getDashboardEvents();
  const invites = await getDashboardInvites();
  const openRegistration = await isOpenRegistrationActive();
  const eventIds = [...events.map((e) => e.id), ...invites.map((i) => i.id)];
  const recentActivities = await getDashboardActivity(eventIds);
  const userName = sessionUser.name || sessionUser.email.split("@")[0] || "User";

  return (
    <DashboardClient
      initialEvents={events}
      initialInvites={invites}
      recentActivities={recentActivities}
      userName={userName}
      userRole={sessionUser.role}
      openRegistration={openRegistration}
    />
  );
}
