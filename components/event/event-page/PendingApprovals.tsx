"use client";

import { Users, X, Check } from "lucide-react";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import type { EventPageStyles } from "./styles";
import { EventCard } from "./EventCard";
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
  return (
    <>
      {/* ── Pending approvals (host only) ── */}
      {isHost && event.pendingRsvps.length > 0 && (
        <EventCard theme={t} aria-label="Pending RSVP approvals">
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
            <Users size={16} style={{ color: t.accent }} />
            <span style={{ fontWeight: 700 }}>Pending Approval ({event.pendingRsvps.length})</span>
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
                <button
                  onClick={() =>
                    setActiveApproval({ rsvpId: r.id, type: "APPROVE", guestName: r.guestName })
                  }
                  disabled={isPending}
                  style={{
                    background: t.accent,
                    color: t.accentFg,
                    border: "none",
                    borderRadius: "8px",
                    padding: "6px 14px",
                    fontFamily: "inherit",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Approve"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() =>
                    setActiveApproval({ rsvpId: r.id, type: "DECLINE", guestName: r.guestName })
                  }
                  disabled={isPending}
                  style={{
                    background: t.inputBg,
                    color: t.textSecondary,
                    border: `1px solid ${t.inputBorder}`,
                    borderRadius: "8px",
                    padding: "6px 14px",
                    fontFamily: "inherit",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                  title="Decline"
                >
                  <X size={14} />
                </button>
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
  S,
  activeApproval,
  setActiveApproval,
  approvalMessage,
  setApprovalMessage,
  handleApprove,
  handleDecline,
}: {
  t: ResolvedTheme;
  S: EventPageStyles;
  activeApproval: { rsvpId: string; type: "APPROVE" | "DECLINE"; guestName: string } | null;
  setActiveApproval: React.Dispatch<
    React.SetStateAction<{ rsvpId: string; type: "APPROVE" | "DECLINE"; guestName: string } | null>
  >;
  approvalMessage: string;
  setApprovalMessage: React.Dispatch<React.SetStateAction<string>>;
  handleApprove: (rsvpId: string, message?: string) => void;
  handleDecline: (rsvpId: string, message?: string) => void;
}) {
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
            {activeApproval.type === "APPROVE" ? "Approve RSVP" : "Decline RSVP"}
          </h3>
          <p style={{ fontSize: "14px", color: t.textSecondary, margin: "0 0 16px" }}>
            {activeApproval.type === "APPROVE"
              ? `Would you like to send a message to ${activeApproval.guestName}?`
              : `Would you like to send a message to ${activeApproval.guestName} explaining why?`}
          </p>
          <textarea
            style={{ ...S.inp, resize: "none", marginBottom: "20px" } as React.CSSProperties}
            rows={3}
            placeholder="Type an optional message..."
            value={approvalMessage}
            onChange={(e) => setApprovalMessage(e.target.value)}
          />
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              onClick={close}
              style={{
                padding: "10px 18px",
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                borderRadius: t.btnRadius,
                color: t.textSecondary,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
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
              style={{
                padding: "10px 18px",
                background: activeApproval.type === "APPROVE" ? t.accent : "#ef4444",
                border: "none",
                borderRadius: t.btnRadius,
                color: activeApproval.type === "APPROVE" ? t.accentFg : "#fff",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 700,
              }}
            >
              {activeApproval.type === "APPROVE" ? "Approve" : "Decline"}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
