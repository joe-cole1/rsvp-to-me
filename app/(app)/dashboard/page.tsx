import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getDashboardEvents, getDashboardActivity, getDashboardInvites } from "@/app/actions/event";
import { isOpenRegistrationActive } from "@/lib/auth";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getSessionUser } from "@/lib/session-user";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/auth/sign-in");

  // Auto-promote INITIAL_ADMIN_EMAIL to ADMIN role on first login
  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase().trim();
  if (initialAdminEmail && sessionUser.email.toLowerCase().trim() === initialAdminEmail && sessionUser.role !== "ADMIN") {
    await db.user.update({ where: { id: sessionUser.id }, data: { role: "ADMIN" } });
    sessionUser.role = "ADMIN";
  }

  const events = await getDashboardEvents();
  const invites = await getDashboardInvites();
  const openRegistration = await isOpenRegistrationActive();
  const eventIds = [...events.map(e => e.id), ...invites.map(i => i.id)];
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
