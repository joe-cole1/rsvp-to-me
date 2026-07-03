"use client";

import { Eye, EyeOff } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import type { EventInput, SettingsOverrides } from "./types";
import type { SettingsPageStyles } from "./styles";
import { Label, Section, Toggle } from "./ui";

export function DisplayOptionsPanel({
  commentsEnabled,
  setCommentsEnabled,
  guestSharingEnabled,
  setGuestSharingEnabled,
  guestListVis,
  setGuestListVis,
  visibility,
  setVisibility,
  guestsCanInvite,
  setGuestsCanInvite,
  password,
  setPassword,
  passwordDirty,
  setPasswordDirty,
  showPassword,
  setShowPassword,
  setPasswordSavedAsNull,
  effectivePasswordHash,
  triggerSaveSettings,
  t,
  S,
}: {
  commentsEnabled: boolean;
  setCommentsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  guestSharingEnabled: boolean;
  setGuestSharingEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  guestListVis: EventInput["guestListVis"];
  setGuestListVis: React.Dispatch<React.SetStateAction<EventInput["guestListVis"]>>;
  visibility: EventInput["visibility"];
  setVisibility: React.Dispatch<React.SetStateAction<EventInput["visibility"]>>;
  guestsCanInvite: boolean;
  setGuestsCanInvite: React.Dispatch<React.SetStateAction<boolean>>;
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  passwordDirty: boolean;
  setPasswordDirty: React.Dispatch<React.SetStateAction<boolean>>;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  setPasswordSavedAsNull: React.Dispatch<React.SetStateAction<boolean>>;
  effectivePasswordHash: string | null;
  triggerSaveSettings: (overrides: SettingsOverrides) => void;
  t: ResolvedTheme;
  S: SettingsPageStyles;
}) {
  return (
    <Section title="Display Options" t={t}>
      <Toggle
        label="Allow guest comments"
        value={commentsEnabled}
        onChange={(val) => {
          setCommentsEnabled(val);
          triggerSaveSettings({ commentsEnabled: val });
        }}
        t={t}
      />

      <Toggle
        label="Allow guest sharing (Copy link & QR code)"
        value={guestSharingEnabled}
        onChange={(val) => {
          setGuestSharingEnabled(val);
          triggerSaveSettings({ guestSharingEnabled: val });
        }}
        t={t}
      />

      <div style={{ marginBottom: "16px" }}>
        <Label t={t}>Guest list visibility</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {(
            [
              ["ALL", "Everyone can see"],
              ["GUESTS_ONLY", "Going guests only"],
              ["HOST_ONLY", "Host only"],
            ] as const
          ).map(([val, label]) => (
            <label
              key={val}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                checked={guestListVis === val}
                onChange={() => {
                  setGuestListVis(val);
                  triggerSaveSettings({ guestListVis: val });
                }}
                style={{ accentColor: t.accent }}
              />
              <span style={{ fontSize: "14px", color: t.textSecondary }}>{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: "16px" }}>
        <Label t={t}>Event visibility</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {(
            [
              ["PUBLIC", "Public — findable by anyone"],
              ["UNLISTED", "Unlisted — only people with the link"],
              ["PRIVATE", "Private — invite only"],
            ] as const
          ).map(([val, label]) => (
            <label
              key={val}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                checked={visibility === val}
                onChange={() => {
                  setVisibility(val);
                  triggerSaveSettings({ visibility: val });
                }}
                style={{ accentColor: t.accent }}
              />
              <span style={{ fontSize: "14px", color: t.textSecondary }}>{label}</span>
            </label>
          ))}
        </div>
      </div>
      {visibility === "PRIVATE" && (
        <Toggle
          label="Allow guests to invite friends"
          value={guestsCanInvite}
          onChange={(val) => {
            setGuestsCanInvite(val);
            triggerSaveSettings({ guestsCanInvite: val });
          }}
          t={t}
        />
      )}
      {visibility === "PRIVATE" && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: t.textMuted,
              }}
            >
              Event password (optional)
            </span>
            {effectivePasswordHash && !passwordDirty && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#22c55e",
                  background: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  borderRadius: "6px",
                  padding: "2px 7px",
                  lineHeight: 1.4,
                }}
              >
                SET
              </span>
            )}
          </div>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder={
                effectivePasswordHash && !passwordDirty ? "••••••••" : "Leave blank for no password"
              }
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordDirty(true);
              }}
              onBlur={() => {
                // Only auto-save when there is no existing password (first-time set).
                // When overwriting/clearing an existing password, the host must confirm.
                if (passwordDirty && !effectivePasswordHash) {
                  triggerSaveSettings({ password: password.trim() || null });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !effectivePasswordHash) {
                  triggerSaveSettings({ password: password.trim() || null });
                  e.currentTarget.blur();
                }
              }}
              style={{ ...S.inp, paddingRight: "40px" }}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: t.textMuted,
                padding: "4px",
                display: "flex",
                alignItems: "center",
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Overwrite / removal confirmation */}
          {effectivePasswordHash && passwordDirty && (
            <div
              style={{
                marginTop: "8px",
                background: "rgba(234,179,8,0.08)",
                border: "1px solid rgba(234,179,8,0.35)",
                borderRadius: "8px",
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#fbbf24",
                  fontWeight: 600,
                  marginBottom: "8px",
                }}
              >
                {password.trim()
                  ? "⚠️ This will replace the current password."
                  : "⚠️ Saving will remove the password requirement."}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => {
                    triggerSaveSettings({ password: password.trim() || null });
                    if (!password.trim()) setPasswordSavedAsNull(true);
                    setPassword("");
                    setPasswordDirty(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    background: t.accent,
                    color: t.accentFg,
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {password.trim() ? "Save new password" : "Remove password"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPassword("");
                    setPasswordDirty(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    background: "transparent",
                    color: t.textSecondary,
                    border: `1px solid ${t.inputBorder}`,
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Hint text when no pending change */}
          {!passwordDirty &&
            (effectivePasswordHash ? (
              <div style={{ fontSize: "12px", color: t.textMuted, marginTop: "6px" }}>
                Type a new password to change it, or clear the field and save to remove it.
              </div>
            ) : password ? (
              <div style={{ fontSize: "12px", color: t.textMuted, marginTop: "6px" }}>
                Guests must enter this password to view the event.
              </div>
            ) : null)}
        </div>
      )}
    </Section>
  );
}
