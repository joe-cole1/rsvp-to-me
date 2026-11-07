"use client";

import { useTranslations } from "next-intl";

import type { ResolvedTheme } from "@/lib/theme";
import type { EventInput, SettingsOverrides } from "./types";
import { Section } from "./ui";
import { GuestRsvpDisplaySettings } from "./GuestRsvpDisplaySettings";
import type { GuestRsvpDisplayFields } from "@/lib/guestRsvpDisplay";
import { Button } from "@/components/ui/Button";
import { Check, Label, SecretInput } from "@/components/ui/Field";
import { InlineAlert, StatusChip } from "@/components/ui/Feedback";
import { Toggle } from "@/components/ui/Toggle";

export function DisplayOptionsPanel({
  commentsEnabled,
  setCommentsEnabled,
  guestSharingEnabled,
  setGuestSharingEnabled,
  guestListVis,
  setGuestListVis,
  guestRsvpDisplay,
  onGuestRsvpDisplayChange,
  visibility,
  setVisibility,
  guestsCanInvite,
  setGuestsCanInvite,
  password,
  setPassword,
  passwordDirty,
  setPasswordDirty,
  setPasswordSavedAsNull,
  effectivePasswordHash,
  triggerSaveSettings,
  t,
}: {
  commentsEnabled: boolean;
  setCommentsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  guestSharingEnabled: boolean;
  setGuestSharingEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  guestListVis: EventInput["guestListVis"];
  setGuestListVis: React.Dispatch<React.SetStateAction<EventInput["guestListVis"]>>;
  guestRsvpDisplay: GuestRsvpDisplayFields;
  onGuestRsvpDisplayChange: (update: Partial<GuestRsvpDisplayFields>) => void;
  visibility: EventInput["visibility"];
  setVisibility: React.Dispatch<React.SetStateAction<EventInput["visibility"]>>;
  guestsCanInvite: boolean;
  setGuestsCanInvite: React.Dispatch<React.SetStateAction<boolean>>;
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  passwordDirty: boolean;
  setPasswordDirty: React.Dispatch<React.SetStateAction<boolean>>;
  setPasswordSavedAsNull: React.Dispatch<React.SetStateAction<boolean>>;
  effectivePasswordHash: string | null;
  triggerSaveSettings: (overrides: SettingsOverrides) => void;
  t: ResolvedTheme;
}) {
  const translate = useTranslations("Ui.Event.DisplayOptionsPanel");
  const hint = { fontSize: "13px", lineHeight: "19px", color: t.textSecondary, marginTop: "6px" };

  return (
    <Section title={translate("displayOptions")} t={t}>
      <div style={{ marginBottom: "16px" }}>
        <Label theme={t}>{translate("eventVisibility")}</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {(
            [
              ["PUBLIC", translate("publicFindableByAnyone")],
              ["UNLISTED", translate("unlistedOnlyPeopleLink")],
              ["PRIVATE", translate("privateInviteOnly")],
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
              <Check
                theme={t}
                type="radio"
                checked={visibility === val}
                onChange={() => {
                  setVisibility(val);
                  triggerSaveSettings({ visibility: val });
                }}
              />
              <span style={{ fontSize: "14px", color: t.textSecondary }}>{label}</span>
            </label>
          ))}
        </div>
      </div>
      {visibility === "PRIVATE" && (
        <Toggle
          label={translate("allowGuestsInviteFriends")}
          value={guestsCanInvite}
          onChange={(val) => {
            setGuestsCanInvite(val);
            triggerSaveSettings({ guestsCanInvite: val });
          }}
          theme={t}
        />
      )}
      {visibility === "PRIVATE" && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Label theme={t} htmlFor="event-password" style={{ marginBottom: 0 }}>
              {translate("eventPasswordOptional")}
            </Label>
            {effectivePasswordHash && !passwordDirty && (
              <StatusChip theme={t} tone="success">
                {translate("set")}
              </StatusChip>
            )}
          </div>
          <SecretInput
            theme={t}
            id="event-password"
            showLabel={translate("showPassword")}
            hideLabel={translate("hidePassword")}
            placeholder={
              effectivePasswordHash && !passwordDirty
                ? "••••••••"
                : translate("leaveBlankNoPassword")
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
            autoComplete="off"
          />

          {/* Overwrite / removal confirmation */}
          {effectivePasswordHash && passwordDirty && (
            <InlineAlert theme={t} tone="warning" style={{ marginTop: "8px", marginBottom: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: "8px" }}>
                {password.trim()
                  ? translate("replaceCurrentPassword")
                  : translate("savingRemovePasswordRequirement")}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <Button
                  theme={t}
                  variant="primary"
                  size="sm"
                  type="button"
                  onClick={() => {
                    triggerSaveSettings({ password: password.trim() || null });
                    if (!password.trim()) setPasswordSavedAsNull(true);
                    setPassword("");
                    setPasswordDirty(false);
                  }}
                  style={{ flex: 1 }}
                >
                  {password.trim() ? translate("saveNewPassword") : translate("removePassword")}
                </Button>
                <Button
                  theme={t}
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setPassword("");
                    setPasswordDirty(false);
                  }}
                  style={{ flex: 1 }}
                >
                  {translate("cancel")}
                </Button>
              </div>
            </InlineAlert>
          )}

          {/* Hint text when no pending change */}
          {!passwordDirty &&
            (effectivePasswordHash ? (
              <div style={hint}>{translate("typeNewPasswordChangeOrClear")}</div>
            ) : password ? (
              <div style={hint}>{translate("guestsMustEnterPasswordViewEvent")}</div>
            ) : null)}
        </div>
      )}

      <Toggle
        label={translate("allowGuestComments")}
        value={commentsEnabled}
        onChange={(val) => {
          setCommentsEnabled(val);
          triggerSaveSettings({ commentsEnabled: val });
        }}
        theme={t}
      />

      <Toggle
        label={translate("allowGuestSharingCopyLinkQr")}
        value={guestSharingEnabled}
        onChange={(val) => {
          setGuestSharingEnabled(val);
          triggerSaveSettings({ guestSharingEnabled: val });
        }}
        theme={t}
      />

      <div style={{ marginBottom: "16px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "10px" }}>
          {translate("guestListVisibility")}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {(
            [
              ["ALL", translate("everyoneCanSee")],
              ["GUESTS_ONLY", translate("goingGuestsOnly")],
              ["HOST_ONLY", translate("hostOnly")],
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
              <Check
                theme={t}
                type="radio"
                checked={guestListVis === val}
                onChange={() => {
                  setGuestListVis(val);
                  triggerSaveSettings({ guestListVis: val });
                }}
              />
              <span style={{ fontSize: "14px", color: t.textSecondary }}>{label}</span>
            </label>
          ))}
        </div>
      </div>
      <GuestRsvpDisplaySettings
        value={guestRsvpDisplay}
        onChange={onGuestRsvpDisplayChange}
        guestListVis={guestListVis}
        t={t}
      />
    </Section>
  );
}
