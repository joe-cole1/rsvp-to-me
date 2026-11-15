import type { ReactNode } from "react";
import { APP_SHELL_THEME } from "@/lib/theme";

/** The root layout owns the document's single main landmark and keyboard bypass. */
export function PageContent({
  children,
  header,
  skipLabel,
}: {
  children: ReactNode;
  header: ReactNode;
  skipLabel: string;
}) {
  return (
    <>
      <a
        href="#main-content"
        className="rsvp-skip-link rsvp-control"
        style={{ backgroundColor: APP_SHELL_THEME.cardBg, color: APP_SHELL_THEME.textPrimary }}
      >
        {skipLabel}
      </a>
      {header}
      <main id="main-content" tabIndex={-1} style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </>
  );
}
