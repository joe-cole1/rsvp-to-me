"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { APP_SHELL, APP_SHELL_THEME as T } from "@/lib/theme";
import { AppCard } from "@/components/ui/AppPrimitives";
import { Check } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
import { InlineAlert } from "@/components/ui/Feedback";

type Visibility = "UNLISTED" | "PUBLIC" | "PRIVATE";

export function NewEventOptionsSection() {
  const tr = useTranslations("Ui.Dashboard");
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [visibility, setVisibility] = useState<Visibility>("UNLISTED");

  return (
    <>
      <AppCard style={{ padding: "20px", marginBottom: "14px" }}>
        <h2
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: APP_SHELL.textMuted,
            textTransform: "none",
            letterSpacing: "0.02em",
            marginBottom: "12px",
          }}
        >
          {tr("rsvpModeHeading")}
        </h2>
        <input type="hidden" name="rsvpEnabled" value={rsvpEnabled ? "true" : "false"} />
        <Toggle
          theme={T}
          label={tr("collectRsvps")}
          description={tr("collectRsvpsDescription")}
          value={rsvpEnabled}
          onChange={setRsvpEnabled}
          style={{ marginBottom: 0 }}
        />
      </AppCard>

      <AppCard style={{ padding: "20px", marginBottom: "14px" }}>
        <h2
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: APP_SHELL.textMuted,
            textTransform: "none",
            letterSpacing: "0.02em",
            marginBottom: "16px",
          }}
        >
          {tr("visibility")}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {(
            [
              ["UNLISTED", tr("unlisted"), tr("unlistedDescription")],
              ["PUBLIC", tr("public"), tr("publicDescription")],
              [
                "PRIVATE",
                tr("private"),
                rsvpEnabled ? tr("privateDescription") : tr("privateInfoOnlyDescription"),
              ],
            ] as const
          ).map(([val, label, desc]) => (
            <label
              key={val}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                background: APP_SHELL.cardBg,
                border: `1px solid ${APP_SHELL.cardBorder}`,
                borderRadius: "12px",
                cursor: "pointer",
              }}
            >
              <Check
                theme={T}
                type="radio"
                name="visibility"
                value={val}
                checked={visibility === val}
                onChange={() => setVisibility(val)}
                style={{ marginTop: "2px" }}
              />
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: APP_SHELL.textPrimary }}>
                  {label}
                </div>
                <div style={{ fontSize: "12px", color: APP_SHELL.textMuted, marginTop: "2px" }}>
                  {desc}
                </div>
              </div>
            </label>
          ))}
        </div>
        {!rsvpEnabled && visibility === "PRIVATE" && (
          <InlineAlert theme={T} tone="info" style={{ marginTop: "12px", marginBottom: 0 }}>
            {tr("privateInfoOnlyCreateNotice")}
          </InlineAlert>
        )}
      </AppCard>
    </>
  );
}
