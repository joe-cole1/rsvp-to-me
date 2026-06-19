import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  getAdminStats,
  getAdminUsers,
  getAdminEvents,
  getInviteCodes,
  getSystemConfig,
} from "@/app/actions/admin";
import AdminClient from "./AdminClient";

export const metadata = {
  title: "Admin Panel | RSVP",
  description: "RSVP to Me System Administration Panel",
};

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true, role: true, avatarUrl: true },
  });

  if (dbUser) {
    const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase().trim();
    if (initialAdminEmail && dbUser.email?.toLowerCase().trim() === initialAdminEmail && dbUser.role !== "ADMIN") {
      await db.user.update({
        where: { id: session.userId },
        data: { role: "ADMIN" },
      });
      dbUser.role = "ADMIN";
    }
  }

  const [stats, users, events, inviteCodes, systemConfig] = await Promise.all([
    getAdminStats(),
    getAdminUsers(),
    getAdminEvents(),
    getInviteCodes(),
    getSystemConfig(),
  ]);

  return (
    <AdminClient
      initialStats={stats}
      initialUsers={users}
      initialEvents={events}
      initialInviteCodes={inviteCodes}
      initialConfig={systemConfig}
      sessionUser={dbUser ? {
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role as "GUEST" | "HOST" | "ADMIN",
        avatarUrl: dbUser.avatarUrl,
      } : null}
    />
  );
}

