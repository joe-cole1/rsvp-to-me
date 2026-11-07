"use client";
import { useTranslations } from "next-intl";

import { X } from "lucide-react";
import { APP_SHELL, APP_SHELL_THEME as T } from "@/lib/theme";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";

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
  const tr = useTranslations("Ui.Admin");

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
          {tr("createUser2")}
        </h3>
        <Button
          theme={T}
          variant="icon"
          onClick={() => setCreateUserOpen(false)}
          aria-label={tr("closeCreateUserDialog")}
        >
          <X size={20} aria-hidden="true" />
        </Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <Field
          theme={T}
          label={tr.rich("nameOptionalMessage", {
            part0: (chunks) => <span style={{ fontWeight: 400 }}>{chunks}</span>,
          })}
        >
          <Input
            theme={T}
            type="text"
            value={createUserName}
            onChange={(e) => setCreateUserName(e.target.value)}
            placeholder={tr("janeSmith")}
          />
        </Field>

        <Field theme={T} label={tr("email2")}>
          <Input
            theme={T}
            type="email"
            value={createUserEmail}
            onChange={(e) => setCreateUserEmail(e.target.value)}
            placeholder={tr("janeExampleCom")}
            required
          />
        </Field>

        <Field
          theme={T}
          label={tr.rich("phoneOptionalMessage", {
            part0: (chunks) => <span style={{ fontWeight: 400 }}>{chunks}</span>,
          })}
        >
          <Input
            theme={T}
            type="tel"
            value={createUserPhone}
            onChange={(e) => setCreateUserPhone(e.target.value)}
            placeholder="+1 555 000 0000"
          />
        </Field>

        <Field theme={T} label={tr("role")}>
          <Select
            theme={T}
            value={createUserRole}
            onChange={(e) => setCreateUserRole(e.target.value as "GUEST" | "HOST" | "ADMIN")}
          >
            <option value="GUEST">{tr("guest2")}</option>
            <option value="HOST">{tr("host2")}</option>
            <option value="ADMIN">{tr("admin2")}</option>
          </Select>
        </Field>

        <Button
          theme={T}
          variant="primary"
          fullWidth
          onClick={handleCreateUser}
          disabled={isPending || !createUserEmail}
          style={{ marginTop: "4px" }}
        >
          {isPending ? tr("creating") : tr("createUser2")}
        </Button>
      </div>
    </Dialog>
  );
}
