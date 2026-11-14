"use client";
import type { CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";

import { APP_SHELL, APP_SHELL_THEME as T } from "@/lib/theme";
import { appCardStyle } from "@/components/ui/AppPrimitives";
import { Button, buttonProps } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import type { BackupFile } from "./types";

export function BackupsTab({
  handleSaveBackupConfig,
  backupSchedule,
  setBackupSchedule,
  backupKeepCount,
  setBackupKeepCount,
  lastBackupTime,
  isSavingBackupConfig,
  handleCreateBackup,
  isBackupRunning,
  backups,
  handleDeleteBackup,
}: {
  handleSaveBackupConfig: (e: React.FormEvent) => Promise<void>;
  backupSchedule: string;
  setBackupSchedule: React.Dispatch<React.SetStateAction<string>>;
  backupKeepCount: number;
  setBackupKeepCount: React.Dispatch<React.SetStateAction<number>>;
  lastBackupTime: string;
  isSavingBackupConfig: boolean;
  handleCreateBackup: () => Promise<void>;
  isBackupRunning: boolean;
  backups: BackupFile[];
  handleDeleteBackup: (filename: string) => Promise<void>;
}) {
  const tr = useTranslations("Ui.Admin");
  const locale = useLocale();
  const BACKUP_PRESETS = [
    { label: tr("backupPreset0"), value: "disabled" },
    { label: tr("backupPreset1"), value: "0 * * * *" },
    { label: tr("backupPreset2"), value: "0 */6 * * *" },
    { label: tr("backupPreset3"), value: "0 0 * * *" },
    { label: tr("backupPreset4"), value: "0 0 */3 * *" },
    { label: tr("backupPreset5"), value: "0 0 * * 0" },
    { label: tr("backupPreset6"), value: "custom" },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Section 1: Backup settings */}
      <div
        style={{
          ...appCardStyle,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: APP_SHELL.textPrimary,
              margin: 0,
            }}
          >
            {tr("backupConfiguration")}
          </h3>
          <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", marginTop: "4px" }}>
            {tr("configureScheduledDatabaseBackupsBackupsAreStoredInThe")}
          </p>
        </div>

        <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

        <form
          onSubmit={handleSaveBackupConfig}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            {(() => {
              const isCustom = !BACKUP_PRESETS.some(
                (p) => p.value !== "custom" && p.value === backupSchedule
              );
              return (
                <Field
                  theme={T}
                  label={tr("backupSchedule")}
                  hint={
                    isCustom
                      ? tr("standard5FieldCronSyntaxMinuteHourDayOf")
                      : backupSchedule === "disabled"
                        ? tr("automatedBackupsOff")
                        : tr("cronSchedule", { schedule: backupSchedule })
                  }
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    theme={T}
                    value={isCustom ? "custom" : backupSchedule}
                    onChange={(e) => {
                      if (e.target.value !== "custom") setBackupSchedule(e.target.value);
                    }}
                  >
                    {BACKUP_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                  {isCustom && (
                    <Input
                      theme={T}
                      type="text"
                      aria-label={tr("backupSchedule")}
                      value={backupSchedule}
                      onChange={(e) => setBackupSchedule(e.target.value)}
                      placeholder={tr("eG00OrDisabled")}
                      required
                      style={{ marginTop: "8px" }}
                    />
                  )}
                </Field>
              );
            })()}

            <Field
              theme={T}
              label={tr("backupsToRetainRotationLimit")}
              hint={tr("maximumNumberOfBackupFilesToKeepOlderBackups")}
              style={{ marginBottom: 0 }}
            >
              <Input
                theme={T}
                type="number"
                min="1"
                max="100"
                value={backupKeepCount}
                onChange={(e) => setBackupKeepCount(parseInt(e.target.value, 10) || 7)}
                required
              />
            </Field>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "10px",
            }}
          >
            <div style={{ fontSize: "12px", color: APP_SHELL.textSecondary }}>
              <strong>{tr("lastBackupCompleted")}</strong>{" "}
              {lastBackupTime ? new Date(lastBackupTime).toLocaleString(locale) : tr("never")}
            </div>

            <Button theme={T} variant="primary" type="submit" disabled={isSavingBackupConfig}>
              {isSavingBackupConfig ? tr("saving2") : tr("saveBackupSettings")}
            </Button>
          </div>
        </form>
      </div>

      {/* Section 2: Manual Trigger */}
      <div
        style={{
          ...appCardStyle,
          padding: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ maxWidth: "70%" }}>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: APP_SHELL.textPrimary,
              margin: 0,
            }}
          >
            {tr("manualDatabaseBackup")}
          </h3>
          <p
            style={{
              color: APP_SHELL.textSecondary,
              fontSize: "13px",
              marginTop: "4px",
              margin: 0,
            }}
          >
            {tr.rich("instantlyTriggerADatabaseSnapshotUsingPgDumpMessage", {
              part0: (chunks) => <code>{chunks}</code>,
            })}
          </p>
        </div>

        <Button
          theme={T}
          variant="secondary"
          type="button"
          onClick={handleCreateBackup}
          disabled={isBackupRunning}
          style={{ whiteSpace: "nowrap" }}
        >
          {isBackupRunning ? tr("backingUp") : tr("createBackupNow")}
        </Button>
      </div>

      {/* Section 3: Backup List */}
      <div
        style={{
          ...appCardStyle,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: APP_SHELL.textPrimary,
              margin: 0,
            }}
          >
            {tr("backupArchives")}
          </h3>
          <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", marginTop: "4px" }}>
            {tr("listOfStoredBackupsOnThisServer")}
            {backups.some((backup) => backup.kind) && <> {tr("migrationSnapshotsHint")}</>}
          </p>
        </div>

        <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

        <div
          className="rsvp-table-wrap"
          style={
            {
              "--rsvp-table-label": T.textSecondary,
              "--rsvp-table-rule": APP_SHELL.navBorder,
            } as CSSProperties
          }
        >
          <table
            role="table"
            className="rsvp-table"
            style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}
          >
            <thead role="rowgroup">
              <tr
                role="row"
                style={{
                  borderBottom: `1px solid ${APP_SHELL.navBorder}`,
                  color: APP_SHELL.textSecondary,
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                <th role="columnheader" style={{ padding: "12px" }}>
                  {tr("filename")}
                </th>
                <th role="columnheader" style={{ padding: "12px" }}>
                  {tr("createdAt")}
                </th>
                <th role="columnheader" style={{ padding: "12px" }}>
                  {tr("fileSize")}
                </th>
                <th role="columnheader" style={{ padding: "12px", textAlign: "right" }}>
                  {tr("actions2")}
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {backups.length === 0 ? (
                <tr role="row">
                  <td
                    colSpan={4}
                    style={{
                      padding: "32px",
                      textAlign: "center",
                      color: APP_SHELL.textMuted,
                    }}
                  >
                    {tr("noBackupArchivesFoundCreateOneManuallyOrConfigure")}
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr
                    role="row"
                    key={b.filename}
                    style={{
                      borderBottom: `1px solid ${APP_SHELL.navBorder}`,
                      fontSize: "14px",
                    }}
                  >
                    <td
                      role="cell"
                      data-label={tr("filename")}
                      style={{
                        padding: "14px 12px",
                        fontFamily: "monospace",
                        overflowWrap: "anywhere",
                        color: APP_SHELL.textPrimary,
                      }}
                    >
                      {b.filename}
                    </td>
                    <td
                      role="cell"
                      data-label={tr("createdAt")}
                      style={{ padding: "14px 12px", color: APP_SHELL.textSecondary }}
                    >
                      {new Date(b.createdAt).toLocaleString(locale)}
                    </td>
                    <td
                      role="cell"
                      data-label={tr("fileSize")}
                      style={{ padding: "14px 12px", color: APP_SHELL.textSecondary }}
                    >
                      {b.sizeBytes >= 1024 * 1024
                        ? `${(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
                        : `${(b.sizeBytes / 1024).toFixed(2)} KB`}
                    </td>
                    <td
                      role="cell"
                      className="rsvp-table-end"
                      data-label={tr("actions2")}
                      style={{ padding: "14px 12px", textAlign: "right" }}
                    >
                      {b.kind ? (
                        <span style={{ color: T.textSecondary }}>
                          {tr(b.kind === "schema" ? "startupSnapshot" : "secretRecoverySnapshot")}
                        </span>
                      ) : (
                        <div style={{ display: "inline-flex", gap: "8px" }}>
                          <a
                            href={`/api/admin/backups/${b.filename}`}
                            download
                            {...buttonProps(T, { variant: "secondary", size: "sm" })}
                          >
                            {tr("download")}
                          </a>
                          <Button
                            theme={T}
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteBackup(b.filename)}
                          >
                            {tr("delete")}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
