import { redirect } from "next/navigation";
import {
  getAdminStats,
  getAdminUsers,
  getAdminEvents,
  getInviteCodes,
  getSystemConfig,
  getBackupConfig,
  listBackupsAction,
  getThemePresets,
} from "@/app/actions/admin";
import AdminClient from "./AdminClient";
import { getSessionUser } from "@/lib/session-user";
import { loadDocs } from "@/lib/docs";
import { db } from "@/lib/db";

export const metadata = {
  title: "Admin Panel | RSVP",
  description: "RSVP to Me System Administration Panel",
};

export default async function AdminPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== "ADMIN") redirect("/dashboard");

  // Auto-promote INITIAL_ADMIN_EMAIL if needed
  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase().trim();
  if (
    initialAdminEmail &&
    sessionUser.email.toLowerCase().trim() === initialAdminEmail &&
    sessionUser.role !== "ADMIN"
  ) {
    await db.user.update({ where: { id: sessionUser.id }, data: { role: "ADMIN" } });
    sessionUser.role = "ADMIN";
  }

  const [
    stats,
    users,
    events,
    inviteCodes,
    systemConfig,
    backupConfig,
    backupsList,
    themePresets,
    docs,
  ] = await Promise.all([
    getAdminStats(),
    getAdminUsers(),
    getAdminEvents(),
    getInviteCodes(),
    getSystemConfig(),
    getBackupConfig(),
    listBackupsAction(),
    getThemePresets(),
    loadDocs("admin"),
  ]);

  return (
    <AdminClient
      initialStats={stats}
      initialUsers={users}
      initialEvents={events}
      initialInviteCodes={inviteCodes}
      initialConfig={systemConfig}
      initialBackupConfig={backupConfig}
      initialBackups={backupsList}
      initialThemePresets={themePresets}
      initialDocs={docs}
      sessionUser={{
        name: sessionUser.name,
        email: sessionUser.email,
        role: sessionUser.role,
        avatarUrl: sessionUser.avatarUrl,
      }}
    />
  );
}
