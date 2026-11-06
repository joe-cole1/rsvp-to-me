"use client";

import { useTranslations } from "next-intl";

import { X } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import type { CoHostEntry, EventInput, SettingsOverrides, SessionUser } from "./types";
import type { SettingsPageStyles } from "./styles";
import { Section } from "./ui";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";

export function HostsPanel({
  event,
  coHosts,
  cohostEmail,
  setCohostEmail,
  cohostError,
  handleAddCohost,
  handleRemoveCohost,
  hostDisplayName,
  setHostDisplayName,
  triggerSaveSettings,
  handleUpdateCohostDisplayName,
  isPending,
  t,
  S,
  pendingInvitations = [],
  handleCancelInvitation,
  isOwner,
  sessionUser,
}: {
  event: EventInput;
  coHosts: CoHostEntry[];
  cohostEmail: string;
  setCohostEmail: React.Dispatch<React.SetStateAction<string>>;
  cohostError: string | null;
  handleAddCohost: () => void;
  handleRemoveCohost: (cohostRecordId: string) => void;
  hostDisplayName: string;
  setHostDisplayName: React.Dispatch<React.SetStateAction<string>>;
  triggerSaveSettings: (overrides: SettingsOverrides) => void;
  handleUpdateCohostDisplayName: (cohostRecordId: string, displayName: string | null) => void;
  isPending: boolean;
  t: ResolvedTheme;
  S: SettingsPageStyles;
  pendingInvitations?: { id: string; email: string }[];
  handleCancelInvitation: (invitationId: string) => void;
  isOwner: boolean;
  sessionUser: SessionUser | null;
}) {
  const translate = useTranslations("Ui.Event.HostsPanel");

  return (
    <Section title={translate("hosts")} t={t}>
      <div style={{ marginBottom: "20px" }}>
        {/* Main Host Section */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "12px 0",
            borderBottom: `1px solid ${t.cardBorder}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={S.av}>
              {(event.hostDisplayName ||
                event.host.name ||
                event.host.email ||
                "H")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>
                {isOwner
                  ? translate("you", {
                      name: event.hostDisplayName ? `(${event.hostDisplayName})` : "",
                    })
                  : event.host.name || event.host.email}
              </div>
              <div style={{ fontSize: "12px", color: t.textMuted }}>
                {isOwner
                  ? translate("host")
                  : translate("hostContact", { email: event.host.email })}
              </div>
            </div>
          </div>
          {isOwner && (
            <Field theme={t} label={translate("displayNameOverride")} style={{ marginBottom: 0 }}>
              <Input
                theme={t}
                placeholder={translate("overrideDisplayNameEvent")}
                value={hostDisplayName}
                onChange={(e) => {
                  setHostDisplayName(e.target.value);
                  triggerSaveSettings({ hostDisplayName: e.target.value || null });
                }}
              />
            </Field>
          )}
        </div>

        {/* Co-hosts Section */}
        {coHosts.map((ch) => (
          <div
            key={ch.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "12px 0",
              borderBottom: `1px solid ${t.cardBorder}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={S.av}>
                {(ch.displayName || ch.user.name || ch.user.email)[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>
                  {ch.user.id === sessionUser?.id
                    ? translate("you", { name: ch.displayName ? `(${ch.displayName})` : "" })
                    : ch.user.name || ch.user.email}
                </div>
                <div style={{ fontSize: "12px", color: t.textMuted }}>
                  {ch.user.email} {translate("coHost")}
                </div>
              </div>
              {(isOwner || ch.user.id === sessionUser?.id) && (
                <Button
                  theme={t}
                  variant="icon"
                  onClick={() => handleRemoveCohost(ch.id)}
                  aria-label={
                    ch.user.id === sessionUser?.id
                      ? translate("removeYourself")
                      : translate("removeCoHost")
                  }
                  title={
                    ch.user.id === sessionUser?.id
                      ? translate("removeYourself")
                      : translate("removeCoHost")
                  }
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              )}
            </div>
            {(isOwner || ch.user.id === sessionUser?.id) && (
              <Field
                theme={t}
                label={
                  ch.user.id === sessionUser?.id
                    ? translate("displayNameOverride2")
                    : translate("coHostDisplayNameOverride")
                }
                style={{ marginBottom: 0 }}
              >
                <Input
                  theme={t}
                  placeholder={
                    ch.user.id === sessionUser?.id
                      ? translate("overrideDisplayName")
                      : translate("overrideDisplayNameCoHost")
                  }
                  defaultValue={ch.displayName || ""}
                  onBlur={(e) => {
                    handleUpdateCohostDisplayName(ch.id, e.target.value || null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </Field>
            )}
          </div>
        ))}

        {/* Pending Invitations Section */}
        {isOwner && pendingInvitations && pendingInvitations.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <h4
              style={{
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: t.textSecondary,
                marginBottom: "8px",
              }}
            >
              {translate("pendingCoHostInvitations")}
            </h4>
            {pendingInvitations.map((invite) => (
              <div
                key={invite.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: `1px solid ${t.cardBorder}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      ...S.av,
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      color: t.textMuted,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✉️
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>
                      {invite.email}
                    </div>
                    <div style={{ fontSize: "12px", color: t.textMuted }}>
                      {translate("invitedPendingAcceptance")}
                    </div>
                  </div>
                </div>
                <Button
                  theme={t}
                  variant="icon"
                  onClick={() => handleCancelInvitation(invite.id)}
                  aria-label={translate("cancelInvitation")}
                  title={translate("cancelInvitation")}
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      {isOwner && (
        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          <Input
            theme={t}
            type="email"
            aria-label={translate("addCoHost")}
            value={cohostEmail}
            onChange={(e) => setCohostEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCohost();
            }}
            placeholder={translate("cohostEmailCom")}
            style={{ flex: 1, width: "auto" }}
          />
          <Button
            theme={t}
            variant="secondary"
            onClick={handleAddCohost}
            disabled={isPending || !cohostEmail.trim()}
            style={{ whiteSpace: "nowrap" }}
          >
            {translate("addCoHost")}
          </Button>
        </div>
      )}
      {isOwner && cohostError && (
        <InlineAlert theme={t} style={{ marginTop: "8px", marginBottom: 0 }}>
          {cohostError}
        </InlineAlert>
      )}
    </Section>
  );
}
