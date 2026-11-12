"use client";
import { useLocale, useTranslations } from "next-intl";

import { APP_SHELL, APP_SHELL_THEME as T } from "@/lib/theme";
import { appCardStyle } from "@/components/ui/AppPrimitives";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import type { AdminUser } from "./types";

export function UsersTab({
  userSearch,
  handleUserSearch,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  setCreateUserOpen,
  filteredUsers,
  handleRoleChange,
  handleCancelDeletion,
  handleUserDeleteImmediately,
  handleUserDelete,
  sessionUserId,
}: {
  userSearch: string;
  handleUserSearch: (val: string) => Promise<void>;
  roleFilter: "ALL" | "HOST" | "GUEST" | "ADMIN";
  setRoleFilter: React.Dispatch<React.SetStateAction<"ALL" | "HOST" | "GUEST" | "ADMIN">>;
  statusFilter: "ALL" | "PENDING_DELETE" | "ACTIVE" | "DELETED";
  setStatusFilter: React.Dispatch<
    React.SetStateAction<"ALL" | "PENDING_DELETE" | "ACTIVE" | "DELETED">
  >;
  setCreateUserOpen: React.Dispatch<React.SetStateAction<boolean>>;
  filteredUsers: AdminUser[];
  handleRoleChange: (userId: string, newRole: "GUEST" | "HOST" | "ADMIN") => void;
  handleCancelDeletion: (userId: string, name: string) => void;
  handleUserDeleteImmediately: (userId: string, name: string) => void;
  handleUserDelete: (userId: string, name: string) => void;
  sessionUserId?: string;
}) {
  const tr = useTranslations("Ui.Admin");
  const locale = useLocale();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <Input
          theme={T}
          type="text"
          aria-label={tr("searchUsersByNameEmailOrPhone")}
          placeholder={tr("searchUsersByNameEmailOrPhone")}
          value={userSearch}
          onChange={(e) => handleUserSearch(e.target.value)}
          style={{ flex: "1 1 200px", width: "auto" }}
        />

        <Field theme={T} label={tr("roleFilterLabel")} style={{ marginBottom: 0 }}>
          <Select
            theme={T}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "ALL" | "HOST" | "GUEST" | "ADMIN")}
            style={{ width: "auto", minWidth: "130px" }}
          >
            <option value="ALL">{tr("allRoles")}</option>
            <option value="ADMIN">{tr("admin")}</option>
            <option value="HOST">{tr("host")}</option>
            <option value="GUEST">{tr("guest")}</option>
          </Select>
        </Field>

        <Field theme={T} label={tr("statusFilterLabel")} style={{ marginBottom: 0 }}>
          <Select
            theme={T}
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "ALL" | "PENDING_DELETE" | "ACTIVE" | "DELETED")
            }
            style={{ width: "auto", minWidth: "160px" }}
          >
            <option value="ALL">{tr("allStatuses")}</option>
            <option value="ACTIVE">{tr("active")}</option>
            <option value="PENDING_DELETE">{tr("pendingDeletion")}</option>
            <option value="DELETED">{tr("deletedAnonymized")}</option>
          </Select>
        </Field>

        <Button
          theme={T}
          variant="primary"
          onClick={() => setCreateUserOpen(true)}
          style={{ whiteSpace: "nowrap" }}
        >
          {tr("createUser")}
        </Button>
      </div>

      {/* Data table: a header row on wide cards; under 480px of card width each row
          stacks into label and value pairs (.rsvp-table in app/globals.css), so the
          page never scrolls sideways. Roles keep the table semantics once rows stack. */}
      <div
        className="rsvp-table-wrap"
        style={
          {
            ...appCardStyle,
            "--rsvp-table-label": T.textSecondary,
            "--rsvp-table-rule": APP_SHELL.navBorder,
          } as React.CSSProperties
        }
      >
        <table role="table" className="rsvp-table" style={{ fontSize: "14px" }}>
          <thead role="rowgroup">
            <tr role="row" style={{ color: T.textSecondary }}>
              <th role="columnheader">{tr("user")}</th>
              <th role="columnheader">{tr("contact")}</th>
              <th role="columnheader">{tr("role")}</th>
              <th role="columnheader" className="rsvp-table-end">
                {tr("actions")}
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {filteredUsers.length === 0 ? (
              <tr role="row">
                <td
                  role="cell"
                  colSpan={4}
                  style={{ padding: "32px", textAlign: "center", color: T.textSecondary }}
                >
                  {tr("noUsersFound")}
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr role="row" key={u.id}>
                  <td role="cell" data-label={tr("user")}>
                    <div style={{ fontWeight: 700, color: T.textPrimary }}>
                      {u.name || tr("unnamedUser")}
                    </div>
                    <div style={{ fontSize: "12px", color: T.textMuted }}>
                      {tr("registeredOn", {
                        date: new Date(u.createdAt).toLocaleDateString(locale),
                      })}
                    </div>
                    {u.deletionScheduledAt && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: T.status.error.text,
                          fontWeight: 600,
                          marginTop: "4px",
                        }}
                      >
                        {tr("deletionRequestedOn")}{" "}
                        {u.deletionRequestedAt
                          ? new Date(u.deletionRequestedAt).toLocaleDateString(locale)
                          : "unknown"}{" "}
                        {tr("scheduledFor")}
                        {new Date(u.deletionScheduledAt).toLocaleDateString(locale)}
                      </div>
                    )}
                  </td>
                  <td role="cell" data-label={tr("contact")}>
                    <div style={{ color: T.textPrimary, overflowWrap: "anywhere" }}>
                      {u.email || "-"}
                    </div>
                    <div style={{ fontSize: "12px", color: T.textSecondary }}>{u.phone || "-"}</div>
                  </td>
                  <td role="cell" data-label={tr("role")}>
                    <Select
                      theme={T}
                      aria-label={tr("role")}
                      value={u.role}
                      onChange={(e) =>
                        handleRoleChange(u.id, e.target.value as "GUEST" | "HOST" | "ADMIN")
                      }
                      disabled={u.id === sessionUserId}
                      style={{ width: "auto" }}
                    >
                      <option value="GUEST">{tr("guest")}</option>
                      <option value="HOST">{tr("host")}</option>
                      <option value="ADMIN">{tr("admin")}</option>
                    </Select>
                  </td>
                  <td role="cell" data-label={tr("actions")} className="rsvp-table-end">
                    {u.id === sessionUserId ? (
                      <span
                        style={{
                          color: T.textSecondary,
                          fontSize: "13px",
                          fontStyle: "italic",
                        }}
                      >
                        {tr("currentSession")}
                      </span>
                    ) : !u.email && !u.phone ? null : u.deletionScheduledAt ? ( // Already deleted / anonymized user: show nothing
                      <div
                        className="rsvp-table-actions"
                        style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}
                      >
                        <Button
                          theme={T}
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            handleCancelDeletion(u.id, u.name || u.email || tr("unknownUser"))
                          }
                        >
                          {tr("restore")}
                        </Button>
                        <Button
                          theme={T}
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            handleUserDeleteImmediately(
                              u.id,
                              u.name || u.email || tr("unknownUser")
                            )
                          }
                        >
                          {tr("deleteNow")}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        theme={T}
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          handleUserDelete(u.id, u.name || u.email || tr("unknownUser"))
                        }
                      >
                        {tr("delete")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
