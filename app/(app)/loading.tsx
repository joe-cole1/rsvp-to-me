"use client";

import { useTranslations } from "next-intl";
import { APP_SHELL } from "@/lib/theme";
import { appCardStyle } from "@/components/ui/AppPrimitives";

/**
 * The skeleton app pages (dashboard, profile, help, admin) show while their data loads:
 * card shapes on the app shell. Event routes have none on purpose: their look comes from
 * the event's theme, which isn't known until the event loads, and a dark skeleton would
 * flash before a light theme (design language, Empty, loading and error states).
 */
export default function AppLoading() {
  const t = useTranslations("Ui.Common");
  const block = (height: number, width = "100%"): React.CSSProperties => ({
    height: `${height}px`,
    width,
    borderRadius: "10px",
    background: APP_SHELL.inputBg,
  });

  return (
    <div
      aria-busy="true"
      style={{ maxWidth: "600px", margin: "0 auto", padding: "40px 16px 80px" }}
    >
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
        <div style={{ ...block(32, "55%"), marginBottom: "12px" }} />
        <div style={{ ...block(16, "35%"), marginBottom: "32px" }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ ...appCardStyle, padding: "20px", marginBottom: "16px" }}>
            <div style={{ ...block(16, "40%"), marginBottom: "14px" }} />
            <div style={{ ...block(12), marginBottom: "10px" }} />
            <div style={block(12, "70%")} />
          </div>
        ))}
      </div>
    </div>
  );
}
