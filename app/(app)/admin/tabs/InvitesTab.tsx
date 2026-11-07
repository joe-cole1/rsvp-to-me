"use client";
import { useLocale, useTranslations } from "next-intl";

import { APP_SHELL, APP_SHELL_THEME as T } from "@/lib/theme";
import { appCardStyle } from "@/components/ui/AppPrimitives";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
import type { AdminInviteCode } from "./types";

export function InvitesTab({
  config,
  handleToggleOpenReg,
  handleCreateCode,
  newCode,
  setNewCode,
  maxUses,
  setMaxUses,
  expiresAt,
  setExpiresAt,
  note,
  setNote,
  isPending,
  inviteCodes,
  handleRevokeCode,
}: {
  config: Record<string, string>;
  handleToggleOpenReg: () => void;
  handleCreateCode: (e: React.FormEvent) => void;
  newCode: string;
  setNewCode: React.Dispatch<React.SetStateAction<string>>;
  maxUses: number | "";
  setMaxUses: React.Dispatch<React.SetStateAction<number | "">>;
  expiresAt: string;
  setExpiresAt: React.Dispatch<React.SetStateAction<string>>;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  isPending: boolean;
  inviteCodes: AdminInviteCode[];
  handleRevokeCode: (id: string) => void;
}) {
  const tr = useTranslations("Ui.Admin");
  const locale = useLocale();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Open Host Registration */}
      <div
        style={{
          ...appCardStyle,
          padding: "24px",
        }}
      >
        <Toggle
          theme={T}
          label={tr("openHostRegistration")}
          description={tr("allowAnyoneToSignUpAsAHostWithout")}
          value={config.open_registration === "true"}
          onChange={handleToggleOpenReg}
          style={{ marginBottom: 0 }}
        />
      </div>

      {config.open_registration === "true" ? (
        <div
          style={{
            ...appCardStyle,
            padding: "32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔓</div>
          <div
            style={{
              fontWeight: 700,
              fontSize: "15px",
              color: APP_SHELL.textPrimary,
              marginBottom: "6px",
            }}
          >
            {tr("openRegistrationIsActive")}
          </div>
          <div style={{ fontSize: "13px", color: APP_SHELL.textSecondary }}>
            {tr("inviteCodesAreNotRequiredWhileOpenRegistrationIs")}
          </div>
        </div>
      ) : (
        <>
          {/* Form */}
          <form
            onSubmit={handleCreateCode}
            className="grid grid-cols-1 sm:grid-cols-2 gap-x-5"
            style={{
              ...appCardStyle,
              padding: "24px",
            }}
          >
            <div className="col-span-1 sm:col-span-2">
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: APP_SHELL.textPrimary,
                  margin: "0 0 20px",
                }}
              >
                {tr("generateHostInviteCode")}
              </h3>
            </div>

            <Field theme={T} label={tr("inviteCodeString")}>
              <Input
                theme={T}
                type="text"
                required
                placeholder={tr("eGViphost2026")}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
            </Field>

            <Field theme={T} label={tr("maxUsesOptional")}>
              <Input
                theme={T}
                type="number"
                placeholder={tr("unlimitedIfEmpty")}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </Field>

            <Field theme={T} label={tr("expiresAtOptional")}>
              <Input
                theme={T}
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </Field>

            <Field theme={T} label={tr("noteDescription")}>
              <Input
                theme={T}
                type="text"
                placeholder={tr("eGInviteCodeForVipSponsors")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>

            <div className="col-span-1 sm:col-span-2 flex justify-end">
              <Button theme={T} variant="primary" type="submit" disabled={isPending}>
                {tr("generateCode")}
              </Button>
            </div>
          </form>

          {/* List */}
          <div
            style={{
              ...appCardStyle,
              overflowX: "auto",
            }}
          >
            <div style={{ minWidth: "700px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: `1px solid ${APP_SHELL.navBorder}`,
                      color: APP_SHELL.textSecondary,
                      textAlign: "left",
                    }}
                  >
                    <th style={{ padding: "16px" }}>{tr("code")}</th>
                    <th style={{ padding: "16px" }}>{tr("usage")}</th>
                    <th style={{ padding: "16px" }}>{tr("expirationsNotes")}</th>
                    <th style={{ padding: "16px", textAlign: "right" }}>{tr("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {inviteCodes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          padding: "32px",
                          textAlign: "center",
                          color: APP_SHELL.textMuted,
                        }}
                      >
                        {tr("noActiveInviteCodes")}
                      </td>
                    </tr>
                  ) : (
                    inviteCodes.map((c) => (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${APP_SHELL.navBorder}` }}>
                        <td style={{ padding: "16px" }}>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: T.accentText,
                            }}
                          >
                            {c.code}
                          </span>
                        </td>
                        <td style={{ padding: "16px", color: APP_SHELL.textPrimary }}>
                          {c.uses} / {c.maxUses ?? "∞"} {tr("uses")}
                        </td>
                        <td style={{ padding: "16px" }}>
                          {c.expiresAt ? (
                            <div style={{ fontSize: "12px", color: T.status.error.text }}>
                              {tr("expires")}
                              {new Date(c.expiresAt).toLocaleDateString(locale)}
                            </div>
                          ) : (
                            <div style={{ fontSize: "12px", color: T.status.success.text }}>
                              {tr("neverExpires")}
                            </div>
                          )}
                          {c.note && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: APP_SHELL.textMuted,
                                marginTop: "2px",
                              }}
                            >
                              {tr("noteMessage", { value0: c.note })}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "16px", textAlign: "right" }}>
                          <Button
                            theme={T}
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRevokeCode(c.id)}
                          >
                            {tr("revoke")}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
