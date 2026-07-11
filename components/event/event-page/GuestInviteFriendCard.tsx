"use client";

import { Mail } from "lucide-react";
import { useState, useTransition } from "react";
import { inviteFriendAsGuest } from "@/app/actions/event";
import type { ResolvedTheme } from "@/lib/theme";

export function GuestInviteFriendCard({
  eventId,
  guestToken,
  theme: t,
}: {
  eventId: string;
  guestToken: string;
  theme: ResolvedTheme;
}) {
  const [target, setTarget] = useState("");
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSend = () => {
    const val = target.trim();
    if (!val) return;
    setStatus("idle");
    setErrorMsg("");
    startTransition(async () => {
      const res = await inviteFriendAsGuest(eventId, guestToken, val);
      if (res.success) {
        setStatus("success");
        setTarget("");
      } else {
        setStatus("error");
        setErrorMsg(res.error ?? "Failed to send invitation");
      }
    });
  };

  const cardStyle: React.CSSProperties = {
    background: t.cardBg,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: t.cardRadius,
    padding: "20px",
    boxShadow: t.cardShadow,
    backdropFilter: "blur(12px)",
    marginBottom: "16px",
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
        <Mail size={16} style={{ color: t.accent }} />
        <span
          style={{
            fontWeight: 700,
            fontSize: "14.5px",
            color: t.textPrimary,
            fontFamily: t.headingFont,
          }}
        >
          Invite a friend
        </span>
      </div>
      <p style={{ fontSize: "13px", color: t.textSecondary, margin: "0 0 12px", lineHeight: 1.4 }}>
        This event is private. You can invite friends by entering their email address or phone
        number below:
      </p>
      <div style={{ display: "flex", gap: "8px", width: "100%" }}>
        <input
          style={{
            flex: 1,
            padding: "10px 14px",
            background: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: t.btnRadius,
            color: t.textPrimary,
            fontFamily: "inherit",
            fontSize: "13.5px",
            outline: "none",
            boxSizing: "border-box",
          }}
          placeholder="friend@email.com or +15551234567"
          value={target}
          disabled={isPending}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && target.trim() && !isPending) handleSend();
          }}
        />
        <button
          onClick={handleSend}
          disabled={!target.trim() || isPending}
          style={{
            padding: "10px 18px",
            background: t.accent,
            color: t.accentFg,
            border: "none",
            borderRadius: t.btnRadius,
            fontFamily: "inherit",
            fontSize: "13px",
            fontWeight: 700,
            cursor: !target.trim() || isPending ? "not-allowed" : "pointer",
            opacity: !target.trim() || isPending ? 0.6 : 1,
            boxShadow: t.accentShadow,
            whiteSpace: "nowrap",
          }}
        >
          {isPending ? "Sending…" : "Send"}
        </button>
      </div>
      {status === "success" && (
        <div style={{ fontSize: "12.5px", color: "#4ade80", fontWeight: 600, marginTop: "8px" }}>
          ✓ Invitation sent successfully!
        </div>
      )}
      {status === "error" && (
        <div style={{ fontSize: "12.5px", color: "#f87171", fontWeight: 600, marginTop: "8px" }}>
          ✕ ${errorMsg}
        </div>
      )}
    </div>
  );
}
