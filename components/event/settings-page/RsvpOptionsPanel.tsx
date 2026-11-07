"use client";

import { useTranslations } from "next-intl";

import type { ResolvedTheme } from "@/lib/theme";
import type { SettingsOverrides } from "./types";
import { Section } from "./ui";
import { Field, Input, Label, Select } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
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
}) {
  const translate = useTranslations("Ui.Event.RsvpOptionsPanel");
  const notifications = useTranslations("Ui.Notifications");
  const group = {
    borderTop: `1px solid ${t.cardBorder}`,
    margin: "16px -20px 16px -20px",
    padding: "16px 20px 0 20px",
  };
  const hint = {
    fontSize: "13px",
    lineHeight: "19px",
    color: t.textSecondary,
    margin: "0 0 12px",
  };

  return (
    <Section title={translate("rsvpOptions")} t={t}>
      <Field theme={t} label={translate("maxPlusOnesPerGuest")}>
        <Select
          theme={t}
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
        </Select>
      </Field>

      {plusOneAllowed && (
        <Toggle
          label={translate("requirePlusOneNames")}
          value={plusOneNamesRequired}
          onChange={(val) => {
            setPlusOneNamesRequired(val);
            triggerSaveSettings({ plusOneNamesRequired: val });
          }}
          theme={t}
        />
      )}

      <div style={group}>
        <Label theme={t} style={{ marginBottom: "12px" }}>
          {translate("rsvpApprovalOptions")}
        </Label>
        <Toggle
          label={translate("requireHostApprovalEachRsvp")}
          value={approvalRequired}
          onChange={(val) => {
            setApprovalRequired(val);
            triggerSaveSettings({ approvalRequired: val });
          }}
          theme={t}
        />
        <Toggle
          label={translate("guestsCanRsvpMaybe")}
          value={maybeEnabled}
          onChange={(val) => {
            setMaybeEnabled(val);
            triggerSaveSettings({ maybeEnabled: val });
          }}
          theme={t}
        />
      </div>
      <div style={group}>
        <Label theme={t} style={{ marginBottom: "12px" }}>
          {translate("notificationSettings")}
        </Label>
        <p style={hint}>{translate("newRsvpAlertsGoCoHosts")}</p>
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
          theme={t}
        />
        <Label theme={t}>{notifications("organizerTitle")}</Label>
        {hostAlertEmail || hostAlertSms ? (
          <NotificationPreferences
            scope={{ kind: "organizer", eventId }}
            theme={t}
            embedded
            onStatus={onNotificationStatus}
          />
        ) : (
          <p style={hint}>{notifications("organizerOff")}</p>
        )}
      </div>
      <Toggle
        label={translate("showRsvpTimestamps")}
        value={showTimestamps}
        onChange={(val) => {
          setShowTimestamps(val);
          triggerSaveSettings({ showTimestamps: val });
        }}
        theme={t}
      />

      <Field theme={t} label={translate("capacityLimitOptional")} style={{ marginTop: "16px" }}>
        <Input
          theme={t}
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
        />
      </Field>
      <Field theme={t} label={translate("rsvpDeadlineOptional")}>
        <Input
          theme={t}
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
        />
      </Field>
      {rsvpDeadline && (
        <Toggle
          label={translate("allowEditingRsvpsAfterDeadline")}
          value={allowEditAfterDeadline}
          onChange={(val) => {
            setAllowEditAfterDeadline(val);
            triggerSaveSettings({ allowEditAfterDeadline: val });
          }}
          theme={t}
        />
      )}
    </Section>
  );
}
