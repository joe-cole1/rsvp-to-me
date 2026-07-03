"use client";

import { X } from "lucide-react";
import { APP_SHELL } from "@/lib/theme";

export function CreateUserModal({
  createUserOpen,
  setCreateUserOpen,
  createUserName,
  setCreateUserName,
  createUserEmail,
  setCreateUserEmail,
  createUserPhone,
  setCreateUserPhone,
  createUserRole,
  setCreateUserRole,
  handleCreateUser,
  isPending,
}: {
  createUserOpen: boolean;
  setCreateUserOpen: React.Dispatch<React.SetStateAction<boolean>>;
  createUserName: string;
  setCreateUserName: React.Dispatch<React.SetStateAction<string>>;
  createUserEmail: string;
  setCreateUserEmail: React.Dispatch<React.SetStateAction<string>>;
  createUserPhone: string;
  setCreateUserPhone: React.Dispatch<React.SetStateAction<string>>;
  createUserRole: "GUEST" | "HOST" | "ADMIN";
  setCreateUserRole: React.Dispatch<React.SetStateAction<"GUEST" | "HOST" | "ADMIN">>;
  handleCreateUser: () => void;
  isPending: boolean;
}) {
  return (
    <>
      {createUserOpen && (
        <>
          <div
            onClick={() => setCreateUserOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 200,
            }}
          />
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 201,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "480px",
                backgroundColor: "rgba(15,9,31,0.98)",
                border: `1px solid ${APP_SHELL.cardBorder}`,
                borderRadius: APP_SHELL.cardRadius,
                padding: "24px",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "20px",
                }}
              >
                <h3 style={{ margin: 0, color: APP_SHELL.textPrimary, fontSize: "18px" }}>
                  Create User
                </h3>
                <button
                  onClick={() => setCreateUserOpen(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: APP_SHELL.textSecondary,
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: APP_SHELL.textSecondary,
                      marginBottom: "6px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Name <span style={{ color: APP_SHELL.textMuted }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={createUserName}
                    onChange={(e) => setCreateUserName(e.target.value)}
                    placeholder="Jane Smith"
                    style={{
                      width: "100%",
                      backgroundColor: APP_SHELL.inputBg,
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      borderRadius: APP_SHELL.inputRadius,
                      padding: "10px 14px",
                      color: APP_SHELL.textPrimary,
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: APP_SHELL.textSecondary,
                      marginBottom: "6px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    value={createUserEmail}
                    onChange={(e) => setCreateUserEmail(e.target.value)}
                    placeholder="jane@example.com"
                    required
                    style={{
                      width: "100%",
                      backgroundColor: APP_SHELL.inputBg,
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      borderRadius: APP_SHELL.inputRadius,
                      padding: "10px 14px",
                      color: APP_SHELL.textPrimary,
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: APP_SHELL.textSecondary,
                      marginBottom: "6px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Phone <span style={{ color: APP_SHELL.textMuted }}>(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={createUserPhone}
                    onChange={(e) => setCreateUserPhone(e.target.value)}
                    placeholder="+1 555 000 0000"
                    style={{
                      width: "100%",
                      backgroundColor: APP_SHELL.inputBg,
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      borderRadius: APP_SHELL.inputRadius,
                      padding: "10px 14px",
                      color: APP_SHELL.textPrimary,
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: APP_SHELL.textSecondary,
                      marginBottom: "6px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Role
                  </label>
                  <select
                    value={createUserRole}
                    onChange={(e) =>
                      setCreateUserRole(e.target.value as "GUEST" | "HOST" | "ADMIN")
                    }
                    style={{
                      width: "100%",
                      backgroundColor: APP_SHELL.inputBg,
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      borderRadius: APP_SHELL.inputRadius,
                      padding: "10px 14px",
                      color: APP_SHELL.textPrimary,
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                      colorScheme: "dark",
                    }}
                  >
                    <option value="GUEST" style={{ backgroundColor: "#12091f" }}>
                      Guest
                    </option>
                    <option value="HOST" style={{ backgroundColor: "#12091f" }}>
                      Host
                    </option>
                    <option value="ADMIN" style={{ backgroundColor: "#12091f" }}>
                      Admin
                    </option>
                  </select>
                </div>

                <button
                  onClick={handleCreateUser}
                  disabled={isPending || !createUserEmail}
                  style={{
                    width: "100%",
                    backgroundColor: APP_SHELL.accent,
                    color: "#fff",
                    border: "none",
                    borderRadius: APP_SHELL.inputRadius,
                    padding: "14px",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: isPending || !createUserEmail ? "not-allowed" : "pointer",
                    opacity: isPending || !createUserEmail ? 0.7 : 1,
                    marginTop: "4px",
                  }}
                >
                  {isPending ? "Creating…" : "Create User"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
