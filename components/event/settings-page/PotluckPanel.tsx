"use client";

import { useTranslations } from "next-intl";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import type { PotluckItemEntry } from "./types";
import { Section } from "./ui";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

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
}) {
  const translate = useTranslations("Ui.Event.PotluckPanel");

  const [addingPotluck, setAddingPotluck] = useState(false);

  return (
    <Section title={translate("managePotluckItems")} t={t}>
      {/* Add Potluck Item Form */}
      {addingPotluck ? (
        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            border: `1px solid ${t.inputBorder}`,
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
            {translate("addNewItem")}
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <Input
              theme={t}
              aria-label={translate("itemNameEGRedWine")}
              style={{ flex: 1, width: "auto" }}
              placeholder={translate("itemNameEGRedWine")}
              value={newPotluckLabel}
              onChange={(e) => setNewPotluckLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddPotluckItem();
              }}
            />
            <Input
              theme={t}
              aria-label={translate("qty")}
              type="number"
              min="1"
              style={{ width: "72px", textAlign: "center", padding: "10px 6px" }}
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
              placeholder={translate("qty")}
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              theme={t}
              variant="primary"
              type="button"
              onClick={() => {
                handleAddPotluckItem();
                setAddingPotluck(false);
              }}
              disabled={!newPotluckLabel.trim() || isPending}
              style={{ flex: 1 }}
            >
              {translate("addItem")}
            </Button>
            <Button
              theme={t}
              variant="secondary"
              type="button"
              onClick={() => {
                setAddingPotluck(false);
                setNewPotluckLabel("");
                setNewPotluckQty(1);
              }}
              style={{ flex: 1 }}
            >
              {translate("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          theme={t}
          variant="add"
          fullWidth
          onClick={() => setAddingPotluck(true)}
          style={{ marginBottom: "20px" }}
        >
          <Plus size={14} aria-hidden="true" /> {translate("addItem")}
        </Button>
      )}

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
          {translate("itemsNeeded")}
          {potluckItems.length})
        </div>
        {potluckItems.length === 0 ? (
          <div style={{ fontSize: "13px", color: t.textSecondary }}>
            {translate("noPotluckItemsAddedYetUse")}
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
                    border: `1px solid ${t.inputBorder}`,
                    borderRadius: "12px",
                    padding: "12px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>
                        {item.label}{" "}
                        {item.quantity > 1 && translate("neededQuantity", { count: item.quantity })}
                      </span>
                      {totalClaimed > 0 && (
                        <span
                          style={{ fontSize: "12px", color: t.textSecondary, marginLeft: "8px" }}
                        >
                          {translate("remainingQuantity", { count: remaining })}
                        </span>
                      )}
                    </div>
                    <Button
                      theme={t}
                      variant="destructive"
                      size="sm"
                      type="button"
                      onClick={() => handleRemovePotluckItem(item.id)}
                    >
                      {translate("remove")}
                    </Button>
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
                            fontSize: "13px",
                            color: t.textSecondary,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                          }}
                        >
                          <span>
                            • {claim.guestName}{" "}
                            <span style={{ color: t.textMuted }}>
                              {translate("bringingQuantity", { count: claim.quantity })}
                            </span>
                          </span>
                          <Button
                            theme={t}
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => handleUnclaimItem(item.id, claim.guestName)}
                            title={translate("removeClaim")}
                          >
                            {translate("unclaim")}
                          </Button>
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
