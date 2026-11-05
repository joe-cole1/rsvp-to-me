"use client";

import { useTranslations } from "next-intl";

import type { ResolvedTheme } from "@/lib/theme";
import type { SettingsOverrides } from "./types";
import type { SettingsPageStyles } from "./styles";
import { Label, Section, Toggle } from "./ui";
import {
  NotificationPreferences,
  type SaveReport,
} from "@/components/notifications/NotificationPreferences";

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
  allowEditAfterDeadline,
  setAllowEditAfterDeadline,
  hostAlertEmail,
  setHostAlertEmail,
  hostAlertSms,
  setHostAlertSms,
  triggerSaveSettings,
  eventId,
  onNotificationStatus,
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
  allowEditAfterDeadline: boolean;
  setAllowEditAfterDeadline: React.Dispatch<React.SetStateAction<boolean>>;
  hostAlertEmail: boolean;
  setHostAlertEmail: React.Dispatch<React.SetStateAction<boolean>>;
  hostAlertSms: boolean;
  setHostAlertSms: React.Dispatch<React.SetStateAction<boolean>>;
  channelConfig: { email: boolean; sms: boolean };
  triggerSaveSettings: (overrides: SettingsOverrides) => void;
  eventId: string;
  onNotificationStatus: SaveReport;
  t: ResolvedTheme;
  S: SettingsPageStyles;
}) {
  const translate = useTranslations("Ui.Event.RsvpOptionsPanel");
  const notifications = useTranslations("Ui.Notifications");

  return (
    <Section title={translate("rsvpOptions")} t={t}>
      {/* Max plus-ones select dropdown */}
      <div style={{ marginBottom: "16px" }}>
        <Label t={t}>{translate("maxPlusOnesPerGuest")}</Label>
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
          <option value={0}>{translate("no1s")}</option>
          {Array.from({ length: 9 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {translate("up")} {i + 1}
            </option>
          ))}
        </select>
      </div>

      {plusOneAllowed && (
        <Toggle
          label={translate("requirePlusOneNames")}
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
          {translate("rsvpApprovalOptions")}
        </div>
        <Toggle
          label={translate("requireHostApprovalEachRsvp")}
          value={approvalRequired}
          onChange={(val) => {
            setApprovalRequired(val);
            triggerSaveSettings({ approvalRequired: val });
          }}
          t={t}
        />
        <Toggle
          label={translate("guestsCanRsvpMaybe")}
          value={maybeEnabled}
          onChange={(val) => {
            setMaybeEnabled(val);
            triggerSaveSettings({ maybeEnabled: val });
          }}
          t={t}
        />
      </div>
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
          {translate("notificationSettings")}
        </div>
        <div style={{ fontSize: "13px", color: t.textMuted, marginBottom: "12px" }}>
          {translate("newRsvpAlertsGoCoHosts")}
        </div>
        <Toggle
          label={notifications("enableHostAlerts")}
          value={hostAlertEmail || hostAlertSms}
          onChange={(val) => {
            // The event decides whether alerts exist; each organizer chooses how to get them.
            setHostAlertEmail(val);
            if (!val) setHostAlertSms(false);
            triggerSaveSettings(
              val ? { hostAlertEmail: true } : { hostAlertEmail: false, hostAlertSms: false }
            );
          }}
          t={t}
        />
        <Label t={t}>{notifications("organizerTitle")}</Label>
        {hostAlertEmail || hostAlertSms ? (
          <NotificationPreferences
            scope={{ kind: "organizer", eventId }}
            theme={t}
            embedded
            onStatus={onNotificationStatus}
          />
        ) : (
          <Label t={t}>{notifications("organizerOff")}</Label>
        )}
      </div>
      <Toggle
        label={translate("showRsvpTimestamps")}
        value={showTimestamps}
        onChange={(val) => {
          setShowTimestamps(val);
          triggerSaveSettings({ showTimestamps: val });
        }}
        t={t}
      />

      <div style={{ marginBottom: "16px", marginTop: "16px" }}>
        <Label t={t}>{translate("capacityLimitOptional")}</Label>
        <input
          type="number"
          placeholder={translate("noLimit")}
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
      <div style={{ marginBottom: "16px" }}>
        <Label t={t}>{translate("rsvpDeadlineOptional")}</Label>
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
      {rsvpDeadline && (
        <Toggle
          label={translate("allowEditingRsvpsAfterDeadline")}
          value={allowEditAfterDeadline}
          onChange={(val) => {
            setAllowEditAfterDeadline(val);
            triggerSaveSettings({ allowEditAfterDeadline: val });
          }}
          t={t}
        />
      )}
    </Section>
  );
}
