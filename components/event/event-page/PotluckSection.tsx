"use client";

import { useTranslations } from "next-intl";

import { Settings, UtensilsCrossed, X } from "lucide-react";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import { EventCard } from "./EventCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

export function PotluckSection({
  event,
  t,
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
  const translate = useTranslations("Ui.Event.PotluckSection");

  return (
    <>
      {/* ── Potluck ── */}
      {(isHost || rsvpStatus === "GOING") &&
        event.potluckItems &&
        event.potluckItems.length > 0 && (
          <EventCard id="potluck" theme={t}>
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
                <UtensilsCrossed size={16} style={{ color: t.accent }} />
                <span style={{ fontWeight: 700 }}>{translate("whatBring")}</span>
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
              <div style={pendingNoticeStyle}>{translate("mustApprovedGuestClaimItemsRsvp")}</div>
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
                          {translate("need")} {item.quantity}
                          {totalClaimed > 0 && translate("remainingQuantity", { count: remaining })}
                          )
                        </span>
                      </div>
                      {remaining > 0 &&
                        !isHost &&
                        !isPendingGuest &&
                        claimingItemId !== item.id && (
                          <Button
                            theme={t}
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setClaimingItemId(item.id);
                              setClaimName(guestName);
                              setClaimQty(1);
                            }}
                            style={{ flexShrink: 0 }}
                          >
                            {translate("iLlBring")}
                          </Button>
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
                              <span style={{ color: t.accentText }}>✓</span>
                              <span>
                                {claim.guestName}{" "}
                                <span style={{ color: t.textMuted }}>
                                  {translate("bringingQuantity", { count: claim.quantity })}
                                </span>
                              </span>
                              {canUnclaim && (
                                <Button
                                  theme={t}
                                  variant="icon"
                                  size="sm"
                                  onClick={() => unclaimItem(item.id, claim.guestName)}
                                  aria-label={`${translate("removeClaim")}: ${claim.guestName}`}
                                  title={translate("removeClaim")}
                                >
                                  <X size={14} aria-hidden="true" />
                                </Button>
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
                        <Input
                          theme={t}
                          style={{ flex: 1, width: "auto" }}
                          aria-label={translate("name")}
                          placeholder={translate("name")}
                          value={claimName}
                          onChange={(e) => setClaimName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && claimName.trim())
                              claimItem(item.id, claimName.trim());
                          }}
                          autoFocus
                        />
                        <Input
                          theme={t}
                          type="number"
                          min="1"
                          max={remaining}
                          aria-label={translate("qty")}
                          style={{ width: "72px", textAlign: "center", padding: "10px 6px" }}
                          value={claimQty}
                          onChange={(e) =>
                            setClaimQty(
                              Math.min(remaining, Math.max(1, parseInt(e.target.value) || 1))
                            )
                          }
                          placeholder={translate("qty")}
                        />
                        <Button
                          theme={t}
                          variant="primary"
                          onClick={() => claimName.trim() && claimItem(item.id, claimName.trim())}
                          disabled={!claimName.trim()}
                        >
                          {translate("claim")}
                        </Button>
                        <Button
                          theme={t}
                          variant="secondary"
                          onClick={() => setClaimingItemId(null)}
                        >
                          {translate("cancel")}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </EventCard>
        )}
    </>
  );
}
