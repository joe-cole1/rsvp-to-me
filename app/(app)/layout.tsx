import { APP_SHELL } from "@/lib/theme";
import { AppNavLogo } from "@/components/ui/AppNav";
import ProfileDropdown from "@/components/ui/ProfileDropdown";
import { getSessionUser } from "@/lib/session-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getSessionUser();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: APP_SHELL.pageBg,
        color: APP_SHELL.textPrimary,
        fontFamily: "inherit",
      }}
    >
      <AppNavLogo
        href="/dashboard"
        trailing={sessionUser ? <ProfileDropdown user={sessionUser} /> : undefined}
      />
      {children}
    </div>
  );
}
