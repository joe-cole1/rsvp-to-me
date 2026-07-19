"use client";

import { X } from "lucide-react";
import { APP_SHELL } from "@/lib/theme";
import { Dialog } from "@/components/ui/Dialog";
import { AppButton, AppInput, appInputStyle } from "@/components/ui/AppPrimitives";

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
    <Dialog
      open={createUserOpen}
      onClose={() => setCreateUserOpen(false)}
      titleId="create-user-dialog-title"
      panelStyle={{
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
        <h3
          id="create-user-dialog-title"
          style={{ margin: 0, color: APP_SHELL.textPrimary, fontSize: "18px" }}
        >
          Create User
        </h3>
        <button
          onClick={() => setCreateUserOpen(false)}
          aria-label="Close create user dialog"
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
          <AppInput
            type="text"
            value={createUserName}
            onChange={(e) => setCreateUserName(e.target.value)}
            placeholder="Jane Smith"
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
          <AppInput
            type="email"
            value={createUserEmail}
            onChange={(e) => setCreateUserEmail(e.target.value)}
            placeholder="jane@example.com"
            required
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
          <AppInput
            type="tel"
            value={createUserPhone}
            onChange={(e) => setCreateUserPhone(e.target.value)}
            placeholder="+1 555 000 0000"
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
            onChange={(e) => setCreateUserRole(e.target.value as "GUEST" | "HOST" | "ADMIN")}
            style={appInputStyle}
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

        <AppButton
          onClick={handleCreateUser}
          disabled={isPending || !createUserEmail}
          style={{
            width: "100%",
            borderRadius: APP_SHELL.inputRadius,
            padding: "14px",
            fontSize: "15px",
            fontWeight: 600,
            marginTop: "4px",
          }}
        >
          {isPending ? "Creating…" : "Create User"}
        </AppButton>
      </div>
    </Dialog>
  );
}
