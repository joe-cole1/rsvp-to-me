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
import { useConfirm } from "@/components/ui/ConfirmDialog";

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
  hasPassword,
  isPending,
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
  hasPassword: boolean;
  isPending: boolean;
  triggerSaveSettings: (overrides: SettingsOverrides) => void;
  t: ResolvedTheme;
}) {
  const translate = useTranslations("Ui.Event.DisplayOptionsPanel");
  const { confirm, dialog } = useConfirm(t);
  const hint = { fontSize: "13px", lineHeight: "19px", color: t.textSecondary, marginTop: "6px" };

  return (
    <Section title={translate("displayOptions")} t={t}>
      {dialog}
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
      {(visibility === "PRIVATE" || hasPassword) && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Label theme={t} htmlFor="event-password" style={{ marginBottom: 0 }}>
              {translate("eventPasswordOptional")}
            </Label>
            {hasPassword && (
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
            placeholder={hasPassword ? "••••••••" : translate("leaveBlankNoPassword")}
            value={password}
            disabled={isPending}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordDirty(true);
            }}
            onBlur={() => {
              // Only auto-save when there is no existing password (first-time set).
              // When overwriting/clearing an existing password, the host must confirm.
              if (passwordDirty && !hasPassword && password.trim() && !isPending) {
                triggerSaveSettings({ password: password.trim() });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !hasPassword) {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            autoComplete="off"
          />

          {hasPassword && passwordDirty && password.trim() && (
            <InlineAlert theme={t} tone="warning" style={{ marginTop: "8px", marginBottom: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: "8px" }}>
                {translate("replaceCurrentPassword")}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <Button
                  theme={t}
                  variant="primary"
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    triggerSaveSettings({ password: password.trim() });
                  }}
                  style={{ flex: 1 }}
                >
                  {translate("saveNewPassword")}
                </Button>
                <Button
                  theme={t}
                  variant="secondary"
                  type="button"
                  disabled={isPending}
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

          {hasPassword && (
            <>
              <div style={hint}>{translate("passwordStaysOnVisibilityChange")}</div>
              <div style={hint}>{translate("changeOrRemovePassword")}</div>
              <Button
                theme={t}
                variant="secondary"
                type="button"
                disabled={isPending}
                style={{ marginTop: "10px" }}
                onClick={async () => {
                  if (
                    await confirm({
                      title: translate("removePasswordTitle"),
                      message: translate("removePasswordConsequence"),
                      confirmLabel: translate("removePassword"),
                    })
                  ) {
                    triggerSaveSettings({ password: null });
                  }
                }}
              >
                {translate("removePassword")}
              </Button>
            </>
          )}
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
