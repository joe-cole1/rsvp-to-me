"use client";

import type { ResolvedTheme } from "@/lib/theme";
import type { PotluckItemEntry } from "./types";
import type { SettingsPageStyles } from "./styles";
import { Section } from "./ui";

export function PotluckPanel({
  potluckItems,
  newPotluckLabel,
  setNewPotluckLabel,
  newPotluckQty,
  setNewPotluckQty,
  handleAddPotluckItem,
  handleRemovePotluckItem,
  handleUnclaimItem,
  isPending,
  t,
  S,
}: {
  potluckItems: PotluckItemEntry[];
  newPotluckLabel: string;
  setNewPotluckLabel: React.Dispatch<React.SetStateAction<string>>;
  newPotluckQty: number | "";
  setNewPotluckQty: React.Dispatch<React.SetStateAction<number | "">>;
  handleAddPotluckItem: () => void;
  handleRemovePotluckItem: (itemId: string) => void;
  handleUnclaimItem: (itemId: string, guestName: string) => void;
  isPending: boolean;
  t: ResolvedTheme;
  S: SettingsPageStyles;
}) {
  return (
    <Section title="Manage Potluck Items" t={t}>
      {/* Add Potluck Item Form */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          padding: "16px",
          borderRadius: t.cardRadius,
          border: `1px solid ${t.cardBorder}`,
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: "14px",
            color: t.textPrimary,
            marginBottom: "12px",
          }}
        >
          Add a New Item
        </div>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <input
            style={{ ...S.inp, flex: 1 }}
            placeholder="Item name (e.g. Red wine, cups, chips)"
            value={newPotluckLabel}
            onChange={(e) => setNewPotluckLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddPotluckItem();
            }}
          />
          <input
            type="number"
            min="1"
            style={{ ...S.inp, width: "70px", textAlign: "center" }}
            value={newPotluckQty}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") {
                setNewPotluckQty("");
              } else {
                const num = parseInt(val);
                setNewPotluckQty(isNaN(num) ? "" : Math.max(1, num));
              }
            }}
            placeholder="Qty"
          />
        </div>
        <button
          type="button"
          onClick={handleAddPotluckItem}
          disabled={!newPotluckLabel.trim() || isPending}
          style={{
            ...S.smallBtn,
            width: "100%",
            padding: "10px",
            borderRadius: "10px",
            fontSize: "13px",
          }}
        >
          Add Item
        </button>
      </div>

      {/* List Existing Potluck Items */}
      <div>
        <div
          style={{
            fontWeight: 700,
            fontSize: "14px",
            color: t.textPrimary,
            marginBottom: "12px",
          }}
        >
          Items Needed ({potluckItems.length})
        </div>
        {potluckItems.length === 0 ? (
          <div style={{ fontSize: "13px", color: t.textMuted, fontStyle: "italic" }}>
            No potluck items added yet. Use the form above to add items for guests to claim.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {potluckItems.map((item) => {
              const totalClaimed = item.claims
                ? item.claims.reduce((sum, c) => sum + c.quantity, 0)
                : 0;
              const remaining = Math.max(0, item.quantity - totalClaimed);
              return (
                <div
                  key={item.id}
                  style={{
                    background: t.cardBg,
                    border: `1px solid ${t.cardBorder}`,
                    borderRadius: t.cardRadius,
                    padding: "12px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>
                        {item.label} {item.quantity > 1 && `(need ${item.quantity})`}
                      </span>
                      {totalClaimed > 0 && (
                        <span style={{ fontSize: "12px", color: t.textMuted, marginLeft: "8px" }}>
                          ({remaining} remaining)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePotluckItem(item.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#ef4444",
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "4px",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  {item.claims && item.claims.length > 0 && (
                    <div
                      style={{
                        marginTop: "8px",
                        borderTop: `1px dashed ${t.cardBorder}`,
                        paddingTop: "6px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      {item.claims.map((claim) => (
                        <div
                          key={claim.id}
                          style={{
                            fontSize: "12px",
                            color: t.textSecondary,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>
                            • {claim.guestName}{" "}
                            <span style={{ color: t.textMuted }}>(bringing {claim.quantity})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnclaimItem(item.id, claim.guestName)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#ef4444",
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "2px 4px",
                            }}
                            title="Remove claim"
                          >
                            Unclaim
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Section>
  );
}
