"use client";

import { APP_SHELL } from "@/lib/theme";
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Open Host Registration */}
      <div
        style={{
          backgroundColor: APP_SHELL.cardBg,
          border: `1px solid ${APP_SHELL.cardBorder}`,
          borderRadius: APP_SHELL.cardRadius,
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: APP_SHELL.textPrimary }}>
              Open Host Registration
            </div>
            <div
              style={{
                fontSize: "12px",
                color: APP_SHELL.textSecondary,
                marginTop: "4px",
              }}
            >
              Allow anyone to sign up as a host without entering an invite code.
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleOpenReg}
            style={{
              width: "50px",
              height: "26px",
              borderRadius: "13px",
              border: "none",
              backgroundColor:
                config.open_registration === "true" ? APP_SHELL.accent : "rgba(255,255,255,0.1)",
              cursor: "pointer",
              position: "relative",
              transition: "background-color 0.2s",
              padding: 0,
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                backgroundColor: "#fff",
                position: "absolute",
                top: "3px",
                left: config.open_registration === "true" ? "27px" : "3px",
                transition: "left 0.2s",
              }}
            />
          </button>
        </div>
      </div>

      {config.open_registration === "true" ? (
        <div
          style={{
            backgroundColor: APP_SHELL.cardBg,
            border: `1px solid ${APP_SHELL.cardBorder}`,
            borderRadius: APP_SHELL.cardRadius,
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
            Open Registration is Active
          </div>
          <div style={{ fontSize: "13px", color: APP_SHELL.textSecondary }}>
            Invite codes are not required while open registration is enabled. Disable it above to
            manage invite codes.
          </div>
        </div>
      ) : (
        <>
          {/* Form */}
          <form
            onSubmit={handleCreateCode}
            className="grid grid-cols-1 sm:grid-cols-2 gap-5"
            style={{
              backgroundColor: APP_SHELL.cardBg,
              border: `1px solid ${APP_SHELL.cardBorder}`,
              borderRadius: APP_SHELL.cardRadius,
              padding: "24px",
            }}
          >
            <div className="col-span-1 sm:col-span-2">
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: APP_SHELL.textPrimary,
                  margin: 0,
                }}
              >
                Generate Host Invite Code
              </h3>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: APP_SHELL.textSecondary,
                  marginBottom: "6px",
                }}
              >
                Invite Code String
              </label>
              <input
                type="text"
                required
                placeholder="e.g. VIPHOST2026"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: APP_SHELL.inputBg,
                  border: `1px solid ${APP_SHELL.inputBorder}`,
                  borderRadius: APP_SHELL.inputRadius,
                  padding: "10px 14px",
                  color: APP_SHELL.textPrimary,
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: APP_SHELL.textSecondary,
                  marginBottom: "6px",
                }}
              >
                Max Uses (Optional)
              </label>
              <input
                type="number"
                placeholder="Unlimited if empty"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value === "" ? "" : Number(e.target.value))}
                style={{
                  width: "100%",
                  backgroundColor: APP_SHELL.inputBg,
                  border: `1px solid ${APP_SHELL.inputBorder}`,
                  borderRadius: APP_SHELL.inputRadius,
                  padding: "10px 14px",
                  color: APP_SHELL.textPrimary,
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: APP_SHELL.textSecondary,
                  marginBottom: "6px",
                }}
              >
                Expires At (Optional)
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: APP_SHELL.inputBg,
                  border: `1px solid ${APP_SHELL.inputBorder}`,
                  borderRadius: APP_SHELL.inputRadius,
                  padding: "10px 14px",
                  color: APP_SHELL.textPrimary,
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: APP_SHELL.textSecondary,
                  marginBottom: "6px",
                }}
              >
                Note / Description
              </label>
              <input
                type="text"
                placeholder="e.g. Invite code for VIP sponsors"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: APP_SHELL.inputBg,
                  border: `1px solid ${APP_SHELL.inputBorder}`,
                  borderRadius: APP_SHELL.inputRadius,
                  padding: "10px 14px",
                  color: APP_SHELL.textPrimary,
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div className="col-span-1 sm:col-span-2 flex justify-end mt-2">
              <button
                type="submit"
                disabled={isPending}
                style={{
                  backgroundColor: APP_SHELL.accent,
                  border: "none",
                  color: "#fff",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                Generate Code
              </button>
            </div>
          </form>

          {/* List */}
          <div
            style={{
              backgroundColor: APP_SHELL.cardBg,
              border: `1px solid ${APP_SHELL.cardBorder}`,
              borderRadius: APP_SHELL.cardRadius,
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
                    <th style={{ padding: "16px" }}>Code</th>
                    <th style={{ padding: "16px" }}>Usage</th>
                    <th style={{ padding: "16px" }}>Expirations / Notes</th>
                    <th style={{ padding: "16px", textAlign: "right" }}>Actions</th>
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
                        No active invite codes.
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
                              color: APP_SHELL.accent,
                            }}
                          >
                            {c.code}
                          </span>
                        </td>
                        <td style={{ padding: "16px", color: APP_SHELL.textPrimary }}>
                          {c.uses} / {c.maxUses ?? "∞"} uses
                        </td>
                        <td style={{ padding: "16px" }}>
                          {c.expiresAt ? (
                            <div style={{ fontSize: "12px", color: "#f87171" }}>
                              Expires: {new Date(c.expiresAt).toLocaleDateString()}
                            </div>
                          ) : (
                            <div style={{ fontSize: "12px", color: "#4ade80" }}>Never expires</div>
                          )}
                          {c.note && (
                            <div
                              style={{
                                fontSize: "11px",
                                color: APP_SHELL.textMuted,
                                marginTop: "2px",
                              }}
                            >
                              Note: {c.note}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "16px", textAlign: "right" }}>
                          <button
                            onClick={() => handleRevokeCode(c.id)}
                            style={{
                              backgroundColor: "transparent",
                              border: "none",
                              color: "#ef4444",
                              cursor: "pointer",
                              fontWeight: 600,
                              fontSize: "13px",
                            }}
                          >
                            Revoke
                          </button>
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
