import type { ReactNode } from "react";
import { APP_SHELL, APP_SHELL_THEME } from "@/lib/theme";
import { AppCard } from "./AppPrimitives";

const T = APP_SHELL_THEME;

/**
 * Error and missing-page screens (design language, Patterns → Empty, loading and error
 * states): the app shell with a title, one sentence and a way back. It paints the shell's
 * page ground itself because the root `not-found.tsx` and `error.tsx` render outside the
 * app layout, and its top padding clears the fixed header on event routes.
 */
export function StatePage({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  /** One or two buttons: the way back first, a retry where one makes sense. */
  actions: ReactNode;
}) {
  return (
    <main
      style={{
        flex: 1,
        minHeight: "100vh",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "85px 16px 48px",
        background: APP_SHELL.pageBg,
        color: T.textPrimary,
      }}
    >
      <AppCard
        style={{ textAlign: "center", padding: "32px 24px", maxWidth: "400px", width: "100%" }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 8px" }}>{title}</h1>
        <p
          style={{ color: T.textSecondary, fontSize: "14px", lineHeight: 1.6, margin: "0 0 24px" }}
        >
          {description}
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          {actions}
        </div>
      </AppCard>
    </main>
  );
}
