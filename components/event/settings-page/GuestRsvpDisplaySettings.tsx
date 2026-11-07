"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

import type { ResolvedTheme } from "@/lib/theme";
import {
  GUEST_DISPLAY_ROWS,
  isGuestRowShown,
  resolveGuestRsvpDisplay,
  showGuestResponseTotal,
  type GuestCountDisplay,
  type GuestDisplayStatus,
  type GuestListDisplay,
  type GuestRsvpDisplayFields,
} from "@/lib/guestRsvpDisplay";
import { Select } from "@/components/ui/Field";
import { GuestRsvpGroup } from "../GuestRsvpGroup";

const NAME_CHOICES: GuestListDisplay[] = ["EXPANDED", "COLLAPSED", "HIDDEN"];
const COUNT_CHOICES: GuestCountDisplay[] = ["EXACT", "CAPPED", "HIDDEN"];

/** Example responses for the live preview: a few names, then "+N more". */
const PREVIEW: Record<GuestDisplayStatus, { count: number; names: string[] }> = {
  GOING: { count: 5, names: ["Ana", "Ben", "Cleo", "Dev", "Eli"] },
  MAYBE: { count: 2, names: ["Fay", "Gus"] },
  NO: { count: 13, names: ["Hal", "Ivy", "Jo"] },
  INVITED: { count: 8, names: ["Kai", "Lu", "Mo"] },
};

/**
 * Guest RSVP display as one choice table: a row per response (Going, Maybe,
 * Can't make it, Invited) with a Names menu and a Count menu. The two are
 * independent, so a row can show its count without names.
 */
export function GuestRsvpDisplaySettings({
  value,
  onChange,
  guestListVis,
  t,
}: {
  value: GuestRsvpDisplayFields;
  onChange: (update: Partial<GuestRsvpDisplayFields>) => void;
  guestListVis: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  t: ResolvedTheme;
}) {
  const shared = useTranslations("Ui.Event.shared");
  const translate = useTranslations("Ui.Event.GuestRsvpDisplaySettings");

  const hostOnly = guestListVis === "HOST_ONLY";
  const divider = `1px solid ${t.cardBorder}`;
  const head: CSSProperties = {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: t.textSecondary,
  };
  const columns = [
    { key: "names", label: translate("columnNames") },
    { key: "count", label: translate("columnCount") },
  ] as const;

  return (
    <section aria-labelledby="guest-rsvp-display-heading" style={{ margin: "20px 0 8px" }}>
      <h3
        id="guest-rsvp-display-heading"
        style={{ fontSize: "14px", fontWeight: 700, color: t.textPrimary, margin: "0 0 4px" }}
      >
        {translate("guestFacingRsvpDisplay")}
      </h3>
      <p style={{ color: t.textSecondary, fontSize: "13px", lineHeight: 1.6, margin: "0 0 12px" }}>
        {translate("intro")}
      </p>
      {hostOnly && (
        <p style={{ color: t.textSecondary, fontSize: "13px", lineHeight: 1.6 }}>
          {translate("guestListCurrentlyHostOnlyThese")}
        </p>
      )}
      <div
        className="rsvp-pref"
        style={
          {
            "--rsvp-pref-cols": columns.length,
            "--rsvp-pref-col": "136px",
            "--rsvp-pref-gap": "8px",
            "--rsvp-pref-border": t.inputBorder,
          } as CSSProperties
        }
      >
        <div role="table" aria-label={translate("tableName")}>
          <div
            role="row"
            className="rsvp-pref-row rsvp-pref-head"
            style={{ borderBottom: divider }}
          >
            <span role="columnheader" style={head}>
              {translate("columnResponse")}
            </span>
            {columns.map((column) => (
              <span key={column.key} role="columnheader" style={head}>
                {column.label}
              </span>
            ))}
          </div>
          {GUEST_DISPLAY_ROWS.map(({ status, listField, countField }, index) => {
            const row = shared("guestStatuses." + status);
            return (
              <div
                key={status}
                role="row"
                className="rsvp-pref-row"
                style={{
                  borderBottom: index < GUEST_DISPLAY_ROWS.length - 1 ? divider : "none",
                }}
              >
                <div role="rowheader">
                  <div style={{ fontSize: "14px", color: t.textPrimary }}>{row}</div>
                  {status === "INVITED" && (
                    <div style={{ fontSize: "13px", color: t.textSecondary, marginTop: "2px" }}>
                      {translate("invitedHint")}
                    </div>
                  )}
                </div>
                <label
                  role="cell"
                  className="rsvp-pref-cell rsvp-pref-cell-menu"
                  style={{ color: t.textSecondary }}
                >
                  <span className="rsvp-pref-cell-label" aria-hidden>
                    {columns[0].label}
                  </span>
                  <Select
                    theme={t}
                    aria-label={translate("cellLabel", { row, column: columns[0].label })}
                    value={value[listField]}
                    disabled={hostOnly}
                    onChange={(event) =>
                      onChange({ [listField]: event.target.value as GuestListDisplay })
                    }
                  >
                    {NAME_CHOICES.map((choice) => (
                      <option key={choice} value={choice}>
                        {translate(`names.${choice}`)}
                      </option>
                    ))}
                  </Select>
                </label>
                <label
                  role="cell"
                  className="rsvp-pref-cell rsvp-pref-cell-menu"
                  style={{ color: t.textSecondary }}
                >
                  <span className="rsvp-pref-cell-label" aria-hidden>
                    {columns[1].label}
                  </span>
                  <Select
                    theme={t}
                    aria-label={translate("cellLabel", { row, column: columns[1].label })}
                    value={value[countField]}
                    disabled={hostOnly}
                    onChange={(event) =>
                      onChange({ [countField]: event.target.value as GuestCountDisplay })
                    }
                  >
                    {COUNT_CHOICES.map((choice) => (
                      <option key={choice} value={choice}>
                        {translate(`count.${choice}`)}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            );
          })}
        </div>
      </div>
      <p style={{ color: t.textSecondary, fontSize: "13px", lineHeight: 1.6, margin: "12px 0 0" }}>
        {translate("footnote")}
      </p>
      <GuestPreview value={value} t={t} />
    </section>
  );
}

/**
 * One live preview of the guest view under the table, drawn with the same
 * heading component guests get. Never one preview per row.
 */
function GuestPreview({ value, t }: { value: GuestRsvpDisplayFields; t: ResolvedTheme }) {
  const shared = useTranslations("Ui.Event.shared");
  const translate = useTranslations("Ui.Event.GuestRsvpDisplaySettings");
  const display = resolveGuestRsvpDisplay(value);
  const groups = GUEST_DISPLAY_ROWS.map(({ status }) => {
    const sample = PREVIEW[status];
    const more = sample.count - sample.names.length;
    return (
      <GuestRsvpGroup
        key={status}
        label={shared("guestStatuses." + status)}
        count={sample.count}
        display={display[status]}
        t={t}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {sample.names.map((name) => (
            <span
              key={name}
              style={{
                padding: "4px 10px",
                borderRadius: "999px",
                background: t.pillBg,
                border: `1px solid ${t.pillBorder}`,
                color: t.textPrimary,
                fontSize: "13px",
              }}
            >
              {name}
            </span>
          ))}
          {more > 0 && (
            <span style={{ alignSelf: "center", color: t.textSecondary, fontSize: "13px" }}>
              {translate("previewMore", { count: more })}
            </span>
          )}
        </div>
      </GuestRsvpGroup>
    );
  });
  const anyShown = GUEST_DISPLAY_ROWS.some(({ status }) => isGuestRowShown(display[status]));
  const total = PREVIEW.GOING.count + PREVIEW.MAYBE.count + PREVIEW.NO.count;

  return (
    <div
      role="region"
      aria-labelledby="guest-rsvp-preview-heading"
      style={{ marginTop: "16px", paddingTop: "14px", borderTop: `1px solid ${t.cardBorder}` }}
    >
      <h4
        id="guest-rsvp-preview-heading"
        style={{ fontSize: "13px", fontWeight: 700, color: t.textPrimary, margin: "0 0 10px" }}
      >
        {translate("previewHeading")}
      </h4>
      {anyShown ? (
        groups
      ) : (
        <p style={{ color: t.textSecondary, fontSize: "13px", margin: 0 }}>
          {translate("previewEmpty")}
        </p>
      )}
      {anyShown && showGuestResponseTotal(display) && (
        <p style={{ color: t.textSecondary, fontSize: "13px", margin: "4px 0 0" }}>
          {translate("previewTotal", { count: total })}
        </p>
      )}
    </div>
  );
}
