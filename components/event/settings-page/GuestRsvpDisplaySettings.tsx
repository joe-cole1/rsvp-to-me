"use client";

import type { ResolvedTheme } from "@/lib/theme";
import {
  GUEST_RSVP_GROUPS,
  resolveGuestRsvpDisplay,
  type GuestCountDisplay,
  type GuestListDisplay,
  type GuestRsvpDisplayFields,
} from "@/lib/guestRsvpDisplay";
import { GuestRsvpGroup } from "../GuestRsvpGroup";
import type { SettingsPageStyles } from "./styles";

export function GuestRsvpDisplaySettings({
  value,
  onChange,
  guestListVis,
  t,
  S,
}: {
  value: GuestRsvpDisplayFields;
  onChange: (update: Partial<GuestRsvpDisplayFields>) => void;
  guestListVis: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  t: ResolvedTheme;
  S: SettingsPageStyles;
}) {
  const display = resolveGuestRsvpDisplay(value);
  const hostOnly = guestListVis === "HOST_ONLY";

  return (
    <section aria-labelledby="guest-rsvp-display-heading" style={{ margin: "20px 0 24px" }}>
      <h3 id="guest-rsvp-display-heading" style={{ fontSize: "14px", fontWeight: 700 }}>
        Guest-facing RSVP display
      </h3>
      <p style={{ color: t.textSecondary, fontSize: "13px", lineHeight: 1.6 }}>
        Choose how guests see response lists and counts on the event page and the full guest list.{" "}
        <strong>Hosts and co-hosts always see all names and exact counts.</strong>
      </p>
      <p style={{ color: t.textMuted, fontSize: "12px", lineHeight: 1.6 }}>
        Show immediately displays the names when the page opens. Show after a click lets guests open
        that list themselves. Do not display removes that response type and its count from
        guest-facing lists. These choices do not change anyone&apos;s RSVP.
      </p>
      {hostOnly && (
        <p style={{ color: t.textSecondary, fontSize: "13px" }}>
          Your guest list is currently Host only. These saved display choices apply when you allow
          guests to see the list.
        </p>
      )}
      {GUEST_RSVP_GROUPS.map(({ status, label, listField, countField }) => (
        <fieldset
          key={status}
          disabled={hostOnly}
          style={{
            border: `1px solid ${t.cardBorder}`,
            borderRadius: "12px",
            padding: "12px",
            margin: "14px 0",
            minWidth: 0,
            opacity: hostOnly ? 0.6 : 1,
          }}
        >
          <legend
            style={{ color: t.textPrimary, fontSize: "14px", fontWeight: 700, padding: "0 6px" }}
          >
            {label}
          </legend>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            <label style={{ color: t.textSecondary, fontSize: "12px" }}>
              Guest names
              <select
                aria-label={`${label}: guest names`}
                value={value[listField]}
                onChange={(event) =>
                  onChange({ [listField]: event.target.value as GuestListDisplay })
                }
                style={{ ...S.inp, marginTop: "6px" }}
              >
                <option value="EXPANDED">Show immediately</option>
                <option value="COLLAPSED">Show after a click</option>
                <option value="HIDDEN">Do not display</option>
              </select>
            </label>
            {value[listField] !== "HIDDEN" && (
              <label style={{ color: t.textSecondary, fontSize: "12px" }}>
                Count shown to guests
                <select
                  aria-label={`${label}: count shown to guests`}
                  value={value[countField]}
                  onChange={(event) =>
                    onChange({ [countField]: event.target.value as GuestCountDisplay })
                  }
                  style={{ ...S.inp, marginTop: "6px" }}
                >
                  <option value="EXACT">Exact count</option>
                  <option value="HIDDEN">No count</option>
                  {status === "NO" && <option value="CAPPED">Limit to 3+</option>}
                </select>
              </label>
            )}
          </div>
          {value[listField] !== "HIDDEN" && value[countField] === "CAPPED" && (
            <p style={{ color: t.textMuted, fontSize: "12px" }}>
              Guests see 1 or 2 for smaller lists, and 3+ for any list of three or more, even after
              opening it. Hosts and co-hosts still see the exact count.
            </p>
          )}
          <div
            style={{
              marginTop: "12px",
              padding: "10px",
              borderRadius: "8px",
              background: t.inputBg,
            }}
          >
            <p style={{ color: t.textMuted, fontSize: "11px", margin: "0 0 8px" }}>
              Guest preview · example responses
            </p>
            {value[listField] === "HIDDEN" ? (
              <span style={{ color: t.textMuted, fontSize: "12px" }}>
                This response type is not displayed to guests.
              </span>
            ) : (
              <GuestRsvpGroup
                key={value[listField]}
                label={label}
                count={status === "NO" ? 13 : status === "GOING" ? 5 : 2}
                display={display[status]}
                t={t}
              >
                <span style={{ color: t.textSecondary, fontSize: "12px" }}>
                  Guest names appear here.
                </span>
              </GuestRsvpGroup>
            )}
          </div>
        </fieldset>
      ))}
      <p style={{ color: t.textMuted, fontSize: "12px", lineHeight: 1.6 }}>
        These are display preferences. Guest list visibility above controls who can access the list.
        Your host view keeps the full details; use the guest previews to see these choices.
      </p>
    </section>
  );
}
