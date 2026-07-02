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

export const metadata = {
  title: "Admin Panel | RSVP",
  description: "RSVP to Me System Administration Panel",
};

export default async function AdminPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== "ADMIN") redirect("/dashboard");

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
