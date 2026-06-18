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

  const [stats, users, events, inviteCodes, systemConfig, dbUser] = await Promise.all([
    getAdminStats(),
    getAdminUsers(),
    getAdminEvents(),
    getInviteCodes(),
    getSystemConfig(),
    db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true, role: true, avatarUrl: true },
    }),
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

