"use client";

import { useState, useTransition } from "react";
import type { ResolvedTheme } from "@/lib/theme";
import type { SettingsPageStyles } from "./styles";
import { deleteEvent } from "@/app/actions/event";

export function DangerZonePanel({
  eventId,
  t,
  S,
}: {
  eventId: string;
  t: ResolvedTheme;
  S: SettingsPageStyles;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    if (confirmText !== "DELETE") return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await deleteEvent(eventId);
        if (res && res.success) {
          window.location.href = "/dashboard";
        } else {
          setError("Failed to delete event.");
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "An error occurred.";
        setError(errMsg);
      }
    });
  };

  return (
    <>
      <div
        style={{
          background: t.cardBg,
          border: "1px solid rgba(239, 68, 68, 0.4)",
          borderRadius: t.cardRadius,
          padding: "20px",
          marginBottom: "16px",
          boxShadow: t.cardShadow || "0 4px 20px rgba(239, 68, 68, 0.05)",
          backdropFilter: "blur(12px)",
        }}
      >
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#ef4444", marginBottom: "12px" }}>
          Danger Zone
        </h2>
        <p
          style={{
            fontSize: "13px",
            color: t.textSecondary,
            marginBottom: "16px",
            lineHeight: "1.5",
          }}
        >
          Delete this event and permanently erase all guest data, RSVPs, comments, polls, and
          potluck items. This action is irreversible.
        </p>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          style={{
            width: "100%",
            padding: "10px 16px",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid #ef4444",
            color: "#ef4444",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.2s ease-in-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
          }}
        >
          Delete Event
        </button>
      </div>

      {showConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: t.cardBg,
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: t.cardRadius,
              padding: "24px",
              width: "100%",
              maxWidth: "360px",
              backdropFilter: "blur(20px)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
              color: t.textPrimary,
            }}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#ef4444",
                margin: "0 0 12px",
              }}
            >
              Delete Event?
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: t.textSecondary,
                margin: "0 0 16px",
                lineHeight: "1.5",
              }}
            >
              This action is permanent and cannot be undone. To confirm, please type{" "}
              <strong style={{ color: t.textPrimary }}>DELETE</strong> in the box below:
            </p>
            <input
              type="text"
              placeholder="DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              style={{
                ...S.inp,
                borderColor: confirmText === "DELETE" ? "#22c55e" : t.inputBorder,
                marginBottom: "16px",
              }}
              autoComplete="off"
            />
            {error && (
              <p
                style={{
                  fontSize: "12px",
                  color: "#ef4444",
                  margin: "0 0 12px",
                  fontWeight: 600,
                }}
              >
                {error}
              </p>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmText("");
                  setError(null);
                }}
                disabled={isPending}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "transparent",
                  color: t.textSecondary,
                  border: `1px solid ${t.inputBorder}`,
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={confirmText !== "DELETE" || isPending}
                style={{
                  flex: 1,
                  padding: "10px",
                  background:
                    confirmText === "DELETE" && !isPending ? "#ef4444" : "rgba(239, 68, 68, 0.4)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: confirmText !== "DELETE" || isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                {isPending ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
