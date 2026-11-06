"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { Mail, MessageSquare, X } from "lucide-react";
import { parseInvitationPaste } from "@/lib/invitation-paste";
import {
  isBlankInvitationRow,
  type InvitationDraftAction,
  type InvitationDraftRow,
  type InvitationRowStatus,
} from "@/lib/invitation-draft-rows";
import type { ResolvedTheme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { mutedText } from "./styles";

type Field = "name" | "contact";

export function RecipientRows({
  theme,
  rows,
  statuses,
  revealAll,
  focusRequest,
  dispatch,
  onSpreadsheetPaste,
  onPasteTooLong,
}: {
  theme: ResolvedTheme;
  rows: InvitationDraftRow[];
  statuses: InvitationRowStatus[];
  /** Show every row's problem, e.g. after the host asks what needs attention. */
  revealAll: boolean;
  /** Row id to focus (its name field), bumped by the composer. */
  focusRequest: { id: string; field: Field; at: number } | null;
  dispatch: Dispatch<InvitationDraftAction>;
  onSpreadsheetPaste: (text: string) => void;
  onPasteTooLong: () => void;
}) {
  const t = useTranslations("Ui.Event.InvitationComposer");
  const container = useRef<HTMLDivElement>(null);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  // Rows keep stable ids, so the target input already exists when focus moves.
  const focus = (id: string, field: Field) =>
    container.current?.querySelector<HTMLInputElement>(`[data-input="${id}:${field}"]`)?.focus();

  useEffect(() => {
    if (!focusRequest) return;
    container.current
      ?.querySelector<HTMLInputElement>(`[data-input="${focusRequest.id}:${focusRequest.field}"]`)
      ?.focus();
  }, [focusRequest]);

  const touch = (id: string) =>
    setTouched((previous) => (previous.has(id) ? previous : new Set(previous).add(id)));

  function handlePaste(event: ClipboardEvent<HTMLInputElement>, row: InvitationDraftRow) {
    const text = event.clipboardData.getData("text");
    if (text.includes("\t")) {
      event.preventDefault();
      onSpreadsheetPaste(text);
      return;
    }
    const pasted = parseInvitationPaste(text);
    if (pasted.tooLong) {
      event.preventDefault();
      onPasteTooLong();
      return;
    }
    const [first] = pasted.rows;
    // A single plain value pastes normally; a list or a named contact fills rows.
    if (pasted.rows.length > 1 || (first?.name && first.contact)) {
      event.preventDefault();
      dispatch({ type: "add", at: row.id, recipients: pasted.rows });
    }
  }

  function problemText(status: InvitationRowStatus): string | null {
    switch (status.kind) {
      case "missingContact":
      case "invalidContact":
      case "invalidName":
        return t(`problems.${status.kind}`);
      case "duplicate":
        return t("problems.duplicate", { number: status.of });
      case "channelDisabled":
        return t(status.channel === "EMAIL" ? "problems.emailDisabled" : "problems.smsDisabled");
      default:
        return null;
    }
  }

  return (
    <div ref={container} style={{ display: "grid", gap: "8px" }}>
      {rows.map((row, index) => {
        const number = index + 1;
        const status = statuses[index];
        const blank = isBlankInvitationRow(row);
        const problem = problemText(status);
        const showProblem = !!problem && (revealAll || touched.has(row.id) || !!row.bulk);
        const describedBy = showProblem ? `invite-row-${row.id}-problem` : undefined;
        const field = (name: Field) => ({
          "data-input": `${row.id}:${name}`,
          value: row[name],
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            dispatch({ type: "edit", id: row.id, field: name, value: event.target.value }),
          onBlur: () => {
            if (!blank) touch(row.id);
          },
          onPaste: (event: ClipboardEvent<HTMLInputElement>) => handlePaste(event, row),
          "aria-invalid": showProblem || undefined,
          "aria-describedby": describedBy,
        });
        return (
          <div key={row.id} data-row-id={row.id}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
              <Input
                theme={theme}
                {...field("name")}
                aria-label={t("nameLabel", { number })}
                placeholder={t("nameOptional")}
                maxLength={120}
                autoComplete="off"
                data-autofocus={blank && index === rows.length - 1 ? "" : undefined}
                style={{ flex: "1 1 160px", width: "auto" }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    focus(row.id, "contact");
                  }
                }}
              />
              <Input
                theme={theme}
                {...field("contact")}
                aria-label={t("contactLabel", { number })}
                placeholder={t("contact")}
                inputMode="email"
                autoComplete="off"
                style={{ flex: "1.4 1 200px", width: "auto" }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (!blank) touch(row.id);
                  // The reducer always keeps a blank row after any filled one.
                  const next = rows[index + 1];
                  if (next) focus(next.id, "name");
                }}
              />
              <span style={{ width: "40px", display: "flex", justifyContent: "center" }}>
                {blank ? null : (
                  <Button
                    theme={theme}
                    variant="icon"
                    type="button"
                    aria-label={t("remove", { number })}
                    onClick={() => {
                      const next = rows[index + 1] ?? rows[index - 1];
                      dispatch({ type: "remove", id: row.id });
                      if (next) focus(next.id, "name");
                    }}
                  >
                    <X size={18} aria-hidden="true" />
                  </Button>
                )}
              </span>
            </div>
            {showProblem ? (
              <p
                id={describedBy}
                style={{ margin: "4px 0 0", fontSize: "13px", color: theme.status.error.text }}
              >
                {problem}
              </p>
            ) : status.kind === "ready" ? (
              <p
                style={{
                  ...mutedText(theme),
                  margin: "4px 0 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {status.channel === "EMAIL" ? (
                  <Mail size={13} aria-hidden="true" />
                ) : (
                  <MessageSquare size={13} aria-hidden="true" />
                )}
                {t(status.channel === "EMAIL" ? "channelEmail" : "channelSms")}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
