import { APP_SHELL } from "@/lib/theme";

export function AppShell({
  children,
  center = false,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: APP_SHELL.pageBg,
        color: APP_SHELL.textPrimary,
        fontFamily: "inherit",
        ...(center
          ? { display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }
          : {}),
      }}
    >
      {children}
    </div>
  );
}
