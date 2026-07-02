"use client";

import { Settings } from "lucide-react";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import type { EventPageStyles } from "./styles";

export function PotluckSection({
  event,
  t,
  S,
  isHost,
  rsvpStatus,
  guestName,
  isPendingGuest,
  pendingNoticeStyle,
  claimingItemId,
  setClaimingItemId,
  claimName,
  setClaimName,
  claimQty,
  setClaimQty,
  claimItem,
  unclaimItem,
}: {
  event: EventData;
  t: ResolvedTheme;
  S: EventPageStyles;
  isHost: boolean;
  rsvpStatus: "GOING" | "MAYBE" | "NO" | "INVITED" | null;
  guestName: string;
  isPendingGuest: boolean;
  pendingNoticeStyle: React.CSSProperties;
  claimingItemId: string | null;
  setClaimingItemId: React.Dispatch<React.SetStateAction<string | null>>;
  claimName: string;
  setClaimName: React.Dispatch<React.SetStateAction<string>>;
  claimQty: number;
  setClaimQty: React.Dispatch<React.SetStateAction<number>>;
  claimItem: (itemId: string, name: string) => Promise<void>;
  unclaimItem: (itemId: string, name: string) => Promise<void>;
}) {
  return (
    <>
      {/* ── Potluck ── */}
      {(isHost || rsvpStatus === "GOING") &&
        event.potluckItems &&
        event.potluckItems.length > 0 && (
          <div id="potluck" style={{ ...S.card, marginBottom: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "6px",
                marginBottom: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "16px" }}>🍽️</span>
                <span style={{ fontWeight: 700 }}>What to Bring</span>
              </div>
              {isHost && (
                <a
                  href={`/e/${event.slug}/settings?section=potluck`}
                  style={{ color: t.textMuted, display: "flex", alignItems: "center" }}
                >
                  <Settings size={13} />
                </a>
              )}
            </div>
            {isPendingGuest && (
              <div style={pendingNoticeStyle}>
                You must be an approved guest to claim items. Your RSVP is awaiting host approval.
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginBottom: event.potluckItems.length > 0 ? "12px" : 0,
              }}
            >
              {event.potluckItems.map((item) => {
                const totalClaimed = item.claims.reduce((sum, c) => sum + c.quantity, 0);
                const remaining = Math.max(0, item.quantity - totalClaimed);
                return (
                  <div
                    key={item.id}
                    style={{
                      borderBottom: `1px solid ${t.cardBorder}`,
                      paddingBottom: "10px",
                      marginBottom: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>
                          {item.label}
                        </span>
                        <span style={{ fontSize: "12px", color: t.textMuted, marginLeft: "6px" }}>
                          (need {item.quantity}
                          {totalClaimed > 0 && `, ${remaining} remaining`})
                        </span>
                      </div>
                      {remaining > 0 &&
                        !isHost &&
                        !isPendingGuest &&
                        claimingItemId !== item.id && (
                          <button
                            onClick={() => {
                              setClaimingItemId(item.id);
                              setClaimName(guestName);
                              setClaimQty(1);
                            }}
                            style={{
                              ...S.mutedBtn,
                              padding: "6px 12px",
                              fontSize: "12px",
                              flexShrink: 0,
                              background: `rgba(${t.accentRgb}, 0.12)`,
                              border: `1px solid rgba(${t.accentRgb}, 0.25)`,
                              color: t.accent,
                            }}
                          >
                            I&apos;ll bring it
                          </button>
                        )}
                    </div>

                    {/* Claims list */}
                    {item.claims.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          paddingLeft: "12px",
                          marginTop: "6px",
                        }}
                      >
                        {item.claims.map((claim) => {
                          const canUnclaim = isHost || claim.guestName === guestName;
                          return (
                            <div
                              key={claim.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontSize: "12.5px",
                                color: t.textSecondary,
                              }}
                            >
                              <span style={{ color: t.accent }}>✓</span>
                              <span>
                                {claim.guestName}{" "}
                                <span style={{ color: t.textMuted }}>
                                  (bringing {claim.quantity})
                                </span>
                              </span>
                              {canUnclaim && (
                                <button
                                  onClick={() => unclaimItem(item.id, claim.guestName)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#ef4444",
                                    fontSize: "11px",
                                    padding: "2px 6px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    opacity: 0.8,
                                  }}
                                  title="Remove this claim"
                                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {claimingItemId === item.id && (
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          marginTop: "8px",
                          paddingLeft: "12px",
                        }}
                      >
                        <input
                          style={{ ...S.inp, flex: 1 }}
                          placeholder="Your name"
                          value={claimName}
                          onChange={(e) => setClaimName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && claimName.trim())
                              claimItem(item.id, claimName.trim());
                          }}
                          autoFocus
                        />
                        <input
                          type="number"
                          min="1"
                          max={remaining}
                          style={{ ...S.inp, width: "70px", textAlign: "center" }}
                          value={claimQty}
                          onChange={(e) =>
                            setClaimQty(
                              Math.min(remaining, Math.max(1, parseInt(e.target.value) || 1))
                            )
                          }
                          placeholder="Qty"
                        />
                        <button
                          onClick={() => claimName.trim() && claimItem(item.id, claimName.trim())}
                          disabled={!claimName.trim()}
                          style={{
                            ...S.mutedBtn,
                            width: "auto",
                            padding: "10px 16px",
                            opacity: !claimName.trim() ? 0.5 : 1,
                            background: `rgba(${t.accentRgb}, 0.12)`,
                            border: `1px solid rgba(${t.accentRgb}, 0.25)`,
                            color: t.accent,
                          }}
                        >
                          Claim
                        </button>
                        <button onClick={() => setClaimingItemId(null)} style={S.mutedBtn}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </>
  );
}
