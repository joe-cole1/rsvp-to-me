"use client";

import type { ResolvedTheme } from "@/lib/theme";
import type { SettingsOverrides } from "./types";
import type { SettingsPageStyles } from "./styles";
import { Label, Section, Toggle } from "./ui";

export function RsvpOptionsPanel({
  plusOneAllowed,
  setPlusOneAllowed,
  plusOneMax,
  setPlusOneMax,
  plusOneNamesRequired,
  setPlusOneNamesRequired,
  approvalRequired,
  setApprovalRequired,
  maybeEnabled,
  setMaybeEnabled,
  showTimestamps,
  setShowTimestamps,
  capacity,
  setCapacity,
  rsvpDeadline,
  setRsvpDeadline,
  triggerSaveSettings,
  t,
  S,
}: {
  plusOneAllowed: boolean;
  setPlusOneAllowed: React.Dispatch<React.SetStateAction<boolean>>;
  plusOneMax: number;
  setPlusOneMax: React.Dispatch<React.SetStateAction<number>>;
  plusOneNamesRequired: boolean;
  setPlusOneNamesRequired: React.Dispatch<React.SetStateAction<boolean>>;
  approvalRequired: boolean;
  setApprovalRequired: React.Dispatch<React.SetStateAction<boolean>>;
  maybeEnabled: boolean;
  setMaybeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  showTimestamps: boolean;
  setShowTimestamps: React.Dispatch<React.SetStateAction<boolean>>;
  capacity: string;
  setCapacity: React.Dispatch<React.SetStateAction<string>>;
  rsvpDeadline: string;
  setRsvpDeadline: React.Dispatch<React.SetStateAction<string>>;
  triggerSaveSettings: (overrides: SettingsOverrides) => void;
  t: ResolvedTheme;
  S: SettingsPageStyles;
}) {
  return (
    <Section title="RSVP Options" t={t}>
      {/* Max plus-ones select dropdown */}
      <div style={{ marginBottom: "16px" }}>
        <Label t={t}>Max plus-ones per guest</Label>
        <select
          style={{ ...S.inp, cursor: "pointer" }}
          value={plusOneAllowed ? plusOneMax : 0}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            const allowed = val > 0;
            setPlusOneAllowed(allowed);
            setPlusOneMax(allowed ? val : 0);
            triggerSaveSettings({ plusOneAllowed: allowed, plusOneMax: allowed ? val : 0 });
          }}
        >
          <option value={0}>No +1s</option>
          {Array.from({ length: 9 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Up to {i + 1}
            </option>
          ))}
        </select>
      </div>

      {plusOneAllowed && (
        <Toggle
          label="Require plus-one names"
          value={plusOneNamesRequired}
          onChange={(val) => {
            setPlusOneNamesRequired(val);
            triggerSaveSettings({ plusOneNamesRequired: val });
          }}
          t={t}
        />
      )}

      <div
        style={{
          borderTop: `1px solid ${t.cardBorder}`,
          margin: "16px -20px 16px -20px",
          padding: "16px 20px 0 20px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "none",
            color: t.textMuted,
            marginBottom: "12px",
            letterSpacing: "0.02em",
          }}
        >
          RSVP & Approval Options
        </div>
        <Toggle
          label="Require host approval for each RSVP"
          value={approvalRequired}
          onChange={(val) => {
            setApprovalRequired(val);
            triggerSaveSettings({ approvalRequired: val });
          }}
          t={t}
        />
        <Toggle
          label="Guests can RSVP «Maybe»"
          value={maybeEnabled}
          onChange={(val) => {
            setMaybeEnabled(val);
            triggerSaveSettings({ maybeEnabled: val });
          }}
          t={t}
        />
      </div>
      <Toggle
        label="Show RSVP timestamps"
        value={showTimestamps}
        onChange={(val) => {
          setShowTimestamps(val);
          triggerSaveSettings({ showTimestamps: val });
        }}
        t={t}
      />

      <div style={{ marginBottom: "16px", marginTop: "16px" }}>
        <Label t={t}>Capacity limit (optional)</Label>
        <input
          type="number"
          placeholder="No limit"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          onBlur={() => {
            const val = capacity.trim() ? Number(capacity) : null;
            triggerSaveSettings({ capacity: val });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = capacity.trim() ? Number(capacity) : null;
              triggerSaveSettings({ capacity: val });
              e.currentTarget.blur();
            }
          }}
          style={S.inp}
        />
      </div>
      <div>
        <Label t={t}>RSVP deadline (optional)</Label>
        <input
          type="datetime-local"
          value={rsvpDeadline}
          onChange={(e) => setRsvpDeadline(e.target.value)}
          onBlur={() => {
            triggerSaveSettings({ rsvpDeadline: rsvpDeadline || null });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              triggerSaveSettings({ rsvpDeadline: rsvpDeadline || null });
              e.currentTarget.blur();
            }
          }}
          style={S.inp}
        />
      </div>
    </Section>
  );
}
