"use client";

import { useTranslations } from "next-intl";

import { Users, X, Check } from "lucide-react";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import { EventCard } from "./EventCard";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Dialog";

export function PendingApprovalsCard({
  event,
  renderAvatar,
  isPending,
  t,
  isHost,
  setActiveApproval,
}: {
  event: EventData;
  renderAvatar: (
    name: string,
    rsvpId?: string | null,
    customStyle?: React.CSSProperties
  ) => React.ReactNode;
  isPending: boolean;
  t: ResolvedTheme;
  isHost: boolean;
  setActiveApproval: React.Dispatch<
    React.SetStateAction<{ rsvpId: string; type: "APPROVE" | "DECLINE"; guestName: string } | null>
  >;
}) {
  const translate = useTranslations("Ui.Event.PendingApprovals");

  return (
    <>
      {/* ── Pending approvals (host only) ── */}
      {isHost && event.pendingRsvps.length > 0 && (
        <EventCard theme={t} aria-label={translate("pendingRsvpApprovals")}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
            <Users size={16} style={{ color: t.accent }} />
            <span style={{ fontWeight: 700 }}>
              {translate("pendingApproval")}
              {event.pendingRsvps.length})
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {event.pendingRsvps.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 0",
                  borderBottom:
                    i < event.pendingRsvps.length - 1 ? `1px solid ${t.cardBorder}` : "none",
                }}
              >
                {renderAvatar(r.guestName, r.id, { width: "28px", height: "28px" })}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>{r.guestName}</div>
                  <div style={{ color: t.textMuted, fontSize: "12px" }}>
                    {r.status.toLowerCase()}
                    {r.plusOneCount > 0 ? ` +${r.plusOneCount}` : ""}
                    {r.guestEmail ? ` · ${r.guestEmail}` : ""}
                  </div>
                </div>
                <Button
                  theme={t}
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    setActiveApproval({ rsvpId: r.id, type: "APPROVE", guestName: r.guestName })
                  }
                  disabled={isPending}
                  aria-label={`${translate("approve")}: ${r.guestName}`}
                  title={translate("approve")}
                >
                  <Check size={14} aria-hidden="true" />
                </Button>
                <Button
                  theme={t}
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setActiveApproval({ rsvpId: r.id, type: "DECLINE", guestName: r.guestName })
                  }
                  disabled={isPending}
                  aria-label={`${translate("decline")}: ${r.guestName}`}
                  title={translate("decline")}
                >
                  <X size={14} aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        </EventCard>
      )}
    </>
  );
}

export function ApprovalMessageModal({
  t,
  activeApproval,
  setActiveApproval,
  approvalMessage,
  setApprovalMessage,
  handleApprove,
  handleDecline,
}: {
  t: ResolvedTheme;
  activeApproval: { rsvpId: string; type: "APPROVE" | "DECLINE"; guestName: string } | null;
  setActiveApproval: React.Dispatch<
    React.SetStateAction<{ rsvpId: string; type: "APPROVE" | "DECLINE"; guestName: string } | null>
  >;
  approvalMessage: string;
  setApprovalMessage: React.Dispatch<React.SetStateAction<string>>;
  handleApprove: (rsvpId: string, message?: string) => void;
  handleDecline: (rsvpId: string, message?: string) => void;
}) {
  const translate = useTranslations("Ui.Event.PendingApprovals");

  const close = () => {
    setActiveApproval(null);
    setApprovalMessage("");
  };

  return (
    <Dialog
      open={activeApproval !== null}
      onClose={close}
      titleId="approval-message-dialog-title"
      panelStyle={{
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: t.cardRadius,
        padding: "24px",
        maxWidth: "400px",
        backdropFilter: "blur(20px)",
        boxShadow: t.cardShadow || "0 10px 40px rgba(0,0,0,0.3)",
      }}
    >
      {activeApproval && (
        <>
          <h3
            id="approval-message-dialog-title"
            style={{ fontSize: "18px", fontWeight: 800, color: t.textPrimary, margin: "0 0 8px" }}
          >
            {activeApproval.type === "APPROVE"
              ? translate("approveRsvp")
              : translate("declineRsvp")}
          </h3>
          <p style={{ fontSize: "14px", color: t.textSecondary, margin: "0 0 16px" }}>
            {activeApproval.type === "APPROVE"
              ? translate("approvalMessage", { name: activeApproval.guestName })
              : translate("declineMessage", { name: activeApproval.guestName })}
          </p>
          <Textarea
            theme={t}
            style={{ resize: "none", marginBottom: "20px" }}
            rows={3}
            aria-label={translate("typeOptionalMessage")}
            placeholder={translate("typeOptionalMessage")}
            value={approvalMessage}
            onChange={(e) => setApprovalMessage(e.target.value)}
          />
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button theme={t} variant="secondary" onClick={close}>
              {translate("cancel")}
            </Button>
            <Button
              theme={t}
              variant={activeApproval.type === "APPROVE" ? "primary" : "destructive"}
              onClick={() => {
                const rsvpId = activeApproval.rsvpId;
                const type = activeApproval.type;
                const msg = approvalMessage.trim() || undefined;
                setActiveApproval(null);
                setApprovalMessage("");
                if (type === "APPROVE") {
                  handleApprove(rsvpId, msg);
                } else {
                  handleDecline(rsvpId, msg);
                }
              }}
            >
              {activeApproval.type === "APPROVE" ? translate("approve") : translate("decline")}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
