import type { HTMLAttributes } from "react";
import { APP_SHELL } from "@/lib/theme";

// Buttons, fields, switches, alerts and the toast live in Button, Choice, Field,
// Toggle and Feedback, and read a ResolvedTheme (APP_SHELL_THEME on app pages).

export const appCardStyle: React.CSSProperties = {
  background: APP_SHELL.cardBg,
  border: `1px solid ${APP_SHELL.cardBorder}`,
  borderRadius: APP_SHELL.cardRadius,
};

export function AppCard({ children, style, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} style={{ ...appCardStyle, ...style }}>
      {children}
    </section>
  );
}
