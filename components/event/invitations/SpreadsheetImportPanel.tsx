"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { PastedRecipient } from "@/lib/invitation-paste";
import {
  detectInvitationDelimiter,
  importInvitationSpreadsheet,
  invitationSpreadsheetWidth,
  MAX_INVITATION_IMPORT_TEXT,
  parseInvitationSpreadsheet,
  suggestInvitationSpreadsheetMapping,
  type InvitationSpreadsheetMapping,
} from "@/lib/invitation-spreadsheet";
import type { ResolvedTheme } from "@/lib/theme";
import { Button, buttonProps } from "@/components/ui/Button";
import { Check, Select, Textarea } from "@/components/ui/Field";
import { mutedText as mutedFor, panelStyle, problemText } from "./styles";

const PREVIEW_ROWS = 5;

export function SpreadsheetImportPanel({
  theme,
  initialText,
  onAdd,
  onCancel,
}: {
  theme: ResolvedTheme;
  initialText: string;
  onAdd: (recipients: PastedRecipient[]) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Ui.Event.InvitationComposer");
  const mutedText = mutedFor(theme);
  const ids = useId();
  const [source, setSource] = useState(initialText);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [override, setOverride] = useState<InvitationSpreadsheetMapping | null>(null);

  const parsed = parseInvitationSpreadsheet(source, detectInvitationDelimiter(source));
  const width = invitationSpreadsheetWidth(parsed.rows);
  const mapping = override ?? suggestInvitationSpreadsheetMapping(parsed.rows);
  const result = parsed.issues.length
    ? { recipients: [], issues: parsed.issues }
    : importInvitationSpreadsheet(parsed.rows, mapping);
  const issue = source.trim() ? result.issues[0] : undefined;
  const data = mapping.hasHeader ? parsed.rows.slice(1) : parsed.rows;

  function load(text: string, name: string | null) {
    setSource(text);
    setFileName(name);
    setOverride(null);
    setFileError(null);
  }

  function columnLabel(column: number) {
    const label = (mapping.hasHeader && parsed.rows[0]?.[column]?.trim()) || "";
    const named = label || t("column", { number: column + 1 });
    const sample = data.find((row) => row[column]?.trim())?.[column]?.trim();
    return sample && sample !== label
      ? t("columnSample", { column: named, sample: sample.slice(0, 32) })
      : named;
  }

  const columns = Array.from({ length: width }, (_, column) => column);
  const update = (next: Partial<InvitationSpreadsheetMapping>) =>
    setOverride({ ...mapping, ...next });

  function columnSelect(
    label: string,
    value: number | undefined,
    taken: number[],
    onChange: (column: number | undefined) => void
  ) {
    return (
      <label style={{ display: "grid", gap: "4px", flex: "1 1 200px" }}>
        <span style={mutedText}>{label}</span>
        <Select
          theme={theme}
          value={value ?? ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? undefined : Number(event.target.value))
          }
        >
          <option value="">{t("noColumn")}</option>
          {columns
            .filter((column) => column === value || !taken.includes(column))
            .map((column) => (
              <option key={column} value={column}>
                {columnLabel(column)}
              </option>
            ))}
        </Select>
      </label>
    );
  }

  const setAt = (list: number[], index: number, column: number | undefined) => {
    const next = [...list];
    if (column === undefined) next.splice(index);
    else next[index] = column;
    return next.filter((value, i) => next.indexOf(value) === i);
  };
  const used = [...mapping.nameColumns, ...mapping.contactColumns];
  const nameSelects = Math.min(3, mapping.nameColumns.length + 1);

  return (
    <section aria-label={t("spreadsheet")} style={panelStyle(theme)}>
      <strong>{t("spreadsheet")}</strong>
      <span style={mutedText}>{t("spreadsheetHelp")}</span>
      {fileName ? (
        <p style={{ ...mutedText, margin: 0, display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ overflowWrap: "anywhere" }}>{fileName}</span>
          <Button
            theme={theme}
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => load("", null)}
          >
            {t("removeFile")}
          </Button>
        </p>
      ) : (
        <label
          {...buttonProps(theme, { variant: "secondary" })}
          className="rsvp-press rsvp-field-within"
          style={{
            ...buttonProps(theme, { variant: "secondary" }).style,
            position: "relative",
            justifySelf: "start",
          }}
        >
          {t("chooseFile")}
          <input
            type="file"
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              if (file.size > MAX_INVITATION_IMPORT_TEXT) {
                setFileError(t("fileTooLarge"));
                input.value = "";
                return;
              }
              file
                .text()
                .then((text) => load(text, file.name))
                .catch(() => setFileError(t("fileUnreadable")))
                .finally(() => {
                  input.value = "";
                });
            }}
          />
        </label>
      )}
      {fileError && (
        <p role="alert" style={problemText(theme)}>
          {fileError}
        </p>
      )}
      {fileName ? null : (
        <label style={{ display: "grid", gap: "4px" }}>
          <span style={mutedText}>{t("pasteCells")}</span>
          <Textarea
            theme={theme}
            rows={4}
            value={source}
            onChange={(event) => load(event.target.value, null)}
          />
        </label>
      )}
      {source.trim() && width > 0 && (
        <>
          <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Check
              theme={theme}
              checked={mapping.hasHeader}
              onChange={(event) => update({ hasHeader: event.target.checked })}
            />
            {t("header")}
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {Array.from({ length: nameSelects }, (_, index) => (
              <div key={`${ids}-name-${index}`} style={{ display: "contents" }}>
                {columnSelect(
                  index === 0 ? t("nameFrom") : t("nameThen"),
                  mapping.nameColumns[index],
                  used,
                  (column) => update({ nameColumns: setAt(mapping.nameColumns, index, column) })
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {columnSelect(t("contactFrom"), mapping.contactColumns[0], used, (column) =>
              update({ contactColumns: setAt(mapping.contactColumns, 0, column) })
            )}
            {mapping.contactColumns.length > 0 &&
              columnSelect(t("contactFallback"), mapping.contactColumns[1], used, (column) =>
                update({ contactColumns: setAt(mapping.contactColumns, 1, column) })
              )}
          </div>
        </>
      )}
      {issue ? (
        <p role="alert" style={problemText(theme)}>
          {t(`spreadsheetIssues.${issue.code}`, { row: (issue.row ?? 0) + 1 })}
        </p>
      ) : (
        result.recipients.length > 0 && (
          <div>
            <p style={{ ...mutedText, margin: "0 0 4px" }}>{t("importPreview")}</p>
            <ul style={{ margin: 0, paddingLeft: "18px", overflowWrap: "anywhere" }}>
              {result.recipients.slice(0, PREVIEW_ROWS).map((row, index) => (
                <li key={index}>
                  {row.name || t("unnamedGuest")} — {row.contact || "—"}
                </li>
              ))}
            </ul>
          </div>
        )
      )}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Button
          theme={theme}
          variant="primary"
          type="button"
          disabled={!!issue || !result.recipients.length}
          onClick={() => onAdd(result.recipients)}
        >
          {t("addFound", { count: result.recipients.length })}
        </Button>
        <Button theme={theme} variant="secondary" type="button" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </section>
  );
}
