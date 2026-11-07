"use client";

import { useEffect, useRef, useState, type CSSProperties, type Dispatch } from "react";
import { useLocale, useTranslations } from "next-intl";
import { previewGuestInvitations, sendGuestInvitations } from "@/app/actions/event";
import {
  describeInvitationRows,
  isBlankInvitationRow,
  type InvitationDraftAction,
  type InvitationDraftState,
} from "@/lib/invitation-draft-rows";
import type { PastedRecipient } from "@/lib/invitation-paste";
import type {
  InvitationPreviewRecipient,
  ReviewedInvitationRecipient,
} from "@/lib/invitation-types";
import type { ResolvedTheme } from "@/lib/theme";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import { PasteListPanel } from "./invitations/PasteListPanel";
import { RecipientRows } from "./invitations/RecipientRows";
import { ReviewStep } from "./invitations/ReviewStep";
import { SpreadsheetImportPanel } from "./invitations/SpreadsheetImportPanel";
import { DEFAULT_INVITE_THEME, footerStyle, mutedText, problemText } from "./invitations/styles";
import { Button } from "@/components/ui/Button";

type Review = { key: string; recipients: InvitationPreviewRecipient[] };
type SendResult = { contact: string; status: string; guestName?: string; error?: string };

/**
 * Two-step invitation flow. The draft rows live in the caller (HostBar) so a
 * closed dialog keeps them; review state lives here and resets per event/locale.
 */
export function InvitationComposer({
  eventId,
  channelConfig,
  theme,
  draft,
  dispatch,
}: {
  eventId: string;
  channelConfig: { email: boolean; sms: boolean };
  theme?: ResolvedTheme;
  draft: InvitationDraftState;
  dispatch: Dispatch<InvitationDraftAction>;
}) {
  const locale = useLocale();
  return (
    <InvitationFlow
      key={`${eventId}:${locale}`}
      eventId={eventId}
      channelConfig={channelConfig}
      theme={theme}
      draft={draft}
      dispatch={dispatch}
    />
  );
}

function InvitationFlow({
  eventId,
  channelConfig,
  theme = DEFAULT_INVITE_THEME,
  draft,
  dispatch,
}: {
  eventId: string;
  channelConfig: { email: boolean; sms: boolean };
  theme?: ResolvedTheme;
  draft: InvitationDraftState;
  dispatch: Dispatch<InvitationDraftAction>;
}) {
  const t = useTranslations("Ui.Event.InvitationComposer");
  const { runWithCaptcha } = useCaptcha();
  const [step, setStep] = useState<"edit" | "review" | "results">("edit");
  const [panel, setPanel] = useState<
    { kind: "paste" } | { kind: "spreadsheet"; text: string } | null
  >(null);
  const [revealAll, setRevealAll] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{
    id: string;
    field: "name" | "contact";
    at: number;
  } | null>(null);
  // Shown until the next bulk add replaces it with that add's outcome.
  const [notice, setNotice] = useState<{
    text: string;
    at: InvitationDraftState["lastAdd"];
  } | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<SendResult[]>([]);
  const request = useRef(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const statuses = describeInvitationRows(draft.rows, channelConfig);
  const ready = statuses.flatMap((status) => (status.kind === "ready" ? [status.recipient] : []));
  const filled = draft.rows.filter((row) => !isBlankInvitationRow(row)).length;
  const unnamed = ready.filter((recipient) => !recipient.name).length;
  const problemIndexes = statuses.flatMap((status, index) =>
    status.kind === "empty" || status.kind === "ready" ? [] : [index]
  );
  // A review belongs to exactly this set of recipients; any change drops it.
  const reviewKey = JSON.stringify([eventId, ready]);
  const currentReview = review?.key === reviewKey ? review : null;

  const last = draft.lastAdd;
  const status =
    notice && notice.at === last
      ? notice.text
      : !last
        ? ""
        : "tooMany" in last
          ? last.room === 0
            ? t("full")
            : t("tooMany", { count: last.tooMany, room: last.room })
          : [
              t("added", { count: last.added }),
              last.skipped ? t("skipped", { count: last.skipped }) : "",
            ]
              .filter(Boolean)
              .join(" ");

  function addRecipients(recipients: PastedRecipient[]) {
    dispatch({ type: "add", at: null, recipients });
    setPanel(null);
  }

  function showProblems() {
    setRevealAll(true);
    const index = problemIndexes[0];
    if (index !== undefined) {
      const field = statuses[index].kind === "invalidName" ? "name" : "contact";
      // `at` changes on every request so asking twice refocuses the same row.
      setFocusRequest((previous) => ({
        id: draft.rows[index].id,
        field,
        at: (previous?.at ?? 0) + 1,
      }));
    }
  }

  function backToEdit() {
    request.current++;
    setReview(null);
    setSelected(new Set());
    setReviewing(false);
    setError("");
    setStep("edit");
  }

  async function startReview() {
    if (problemIndexes.length) {
      showProblems();
      return;
    }
    if (!ready.length) return;
    const id = ++request.current;
    const key = reviewKey;
    setStep("review");
    setReviewing(true);
    setError("");
    setNotice(null);
    try {
      const response = await previewGuestInvitations(eventId, ready);
      if (!active.current || id !== request.current) return;
      setReview({ key, recipients: response.recipients });
      // Only new recipients on an enabled channel start selected; resends are opt-in.
      setSelected(
        new Set(
          response.recipients
            .filter(
              (row) =>
                row.disposition === "new" &&
                (row.channel === "EMAIL" ? channelConfig.email : channelConfig.sms)
            )
            .map((row) => row.contact)
        )
      );
    } catch (reason) {
      if (!active.current || id !== request.current) return;
      setError(reason instanceof Error ? reason.message : t("failed"));
      setStep("edit");
    } finally {
      if (active.current && id === request.current) setReviewing(false);
    }
  }

  async function send() {
    if (!currentReview || busy || !selected.size) return;
    const names = new Map(ready.map((recipient) => [recipient.contact, recipient.name]));
    const recipients: ReviewedInvitationRecipient[] = currentReview.recipients
      .filter((row) => selected.has(row.contact) && row.disposition !== "conflict")
      .map((row) => {
        const name = names.get(row.contact);
        return {
          contact: row.contact,
          ...(name ? { name } : {}),
          expectedDisposition:
            row.disposition as ReviewedInvitationRecipient["expectedDisposition"],
          expectedGuestName: row.guestName,
        };
      });
    const id = ++request.current;
    setBusy(true);
    setError("");
    try {
      const response = await runWithCaptcha("host_invite", (token) =>
        sendGuestInvitations(eventId, recipients, token)
      );
      // HostBar owns the draft, so drop delivered rows even if the dialog closed mid-send.
      dispatch({
        type: "sent",
        contacts: response.results.filter((row) => row.status === "sent").map((row) => row.contact),
      });
      if (!active.current) return;
      setResults(response.results);
      // Failures stay in the draft and need a fresh review before any retry.
      setReview(null);
      setSelected(new Set());
      setStep("results");
    } catch (reason) {
      if (!active.current) return;
      if (id === request.current) {
        setReview(null);
        setSelected(new Set());
        setStep("edit");
      }
      setError(reason instanceof Error ? reason.message : t("failed"));
    } finally {
      if (active.current) setBusy(false);
    }
  }

  const sentCount = results.filter((row) => row.status === "sent").length;
  const failed = results.filter((row) => row.status !== "sent");
  const muted = mutedText(theme);
  const stepStyle = (current: boolean): CSSProperties => ({
    fontWeight: current ? 700 : 500,
    color: current ? theme.textPrimary : theme.textSecondary,
  });

  return (
    <section
      aria-label={t("composer")}
      style={{
        display: "grid",
        gap: "14px",
        fontSize: "14px",
        lineHeight: 1.5,
        overflowWrap: "anywhere",
        color: theme.textPrimary,
      }}
    >
      <ol
        aria-label={t("steps")}
        style={{ display: "flex", gap: "16px", margin: 0, padding: 0, listStyle: "none" }}
      >
        <li style={stepStyle(step === "edit")} aria-current={step === "edit" ? "step" : undefined}>
          1. {t("stepAdd")}
        </li>
        <li style={stepStyle(step !== "edit")} aria-current={step !== "edit" ? "step" : undefined}>
          2. {t("stepReview")}
        </li>
      </ol>

      {step === "edit" && (
        <>
          <p style={{ ...muted, margin: 0 }}>{t("help")}</p>
          {panel?.kind === "paste" && (
            <PasteListPanel
              theme={theme}
              onAdd={addRecipients}
              onCancel={() => setPanel(null)}
              onSpreadsheetPaste={(text) => setPanel({ kind: "spreadsheet", text })}
            />
          )}
          {panel?.kind === "spreadsheet" && (
            <SpreadsheetImportPanel
              key={panel.text}
              theme={theme}
              initialText={panel.text}
              onAdd={addRecipients}
              onCancel={() => setPanel(null)}
            />
          )}
          <RecipientRows
            theme={theme}
            rows={draft.rows}
            statuses={statuses}
            revealAll={revealAll}
            focusRequest={focusRequest}
            dispatch={dispatch}
            onSpreadsheetPaste={(text) => setPanel({ kind: "spreadsheet", text })}
            onPasteTooLong={() => setNotice({ text: t("tooLong"), at: draft.lastAdd })}
          />
          {!panel && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <Button
                theme={theme}
                variant="secondary"
                type="button"
                onClick={() => setPanel({ kind: "paste" })}
              >
                {t("pasteList")}
              </Button>
              <Button
                theme={theme}
                variant="secondary"
                type="button"
                onClick={() => setPanel({ kind: "spreadsheet", text: "" })}
              >
                {t("spreadsheet")}
              </Button>
            </div>
          )}
          {status && (
            <p role="status" style={{ ...muted, margin: 0 }}>
              {status}
            </p>
          )}
          {error && (
            <p role="alert" style={problemText(theme)}>
              {error}
            </p>
          )}
          <div style={footerStyle(theme)}>
            <span style={{ ...muted, flex: "1 1 220px" }}>
              {t("recipientCount", { count: filled })}
              {unnamed > 0 && <> · {t("withoutNames", { count: unnamed })}</>}
              {problemIndexes.length > 0 && (
                <>
                  {" · "}
                  <Button theme={theme} variant="link" type="button" onClick={showProblems}>
                    {t("needsAttention", { count: problemIndexes.length })}
                  </Button>
                </>
              )}
            </span>
            {draft.history.length > 0 && (
              <Button
                theme={theme}
                variant="secondary"
                type="button"
                onClick={() => dispatch({ type: "undo" })}
              >
                {t("undo")}
              </Button>
            )}
            {filled > 0 && (
              <Button
                theme={theme}
                variant="secondary"
                type="button"
                onClick={() => dispatch({ type: "clear" })}
              >
                {t("clear")}
              </Button>
            )}
            <Button
              theme={theme}
              variant="primary"
              type="button"
              disabled={!ready.length || problemIndexes.length > 0}
              onClick={() => startReview()}
            >
              {t("review", { count: ready.length })}
            </Button>
            {problemIndexes.length > 0 && (
              <p style={{ ...muted, margin: 0, flexBasis: "100%" }}>{t("fixFirst")}</p>
            )}
            {unnamed > 0 && !problemIndexes.length && (
              <p style={{ ...muted, margin: 0, flexBasis: "100%" }}>{t("unnamedHelp")}</p>
            )}
          </div>
        </>
      )}

      {step === "review" && (
        <>
          {reviewing || !currentReview ? (
            <p role="status" style={muted}>
              {t("loading")}
            </p>
          ) : (
            <ReviewStep
              key={currentReview.key}
              theme={theme}
              eventId={eventId}
              reviewKey={currentReview.key}
              recipients={currentReview.recipients}
              selected={selected}
              disabled={busy}
              onToggle={(contact, checked) =>
                setSelected((previous) => {
                  const next = new Set(previous);
                  if (checked) next.add(contact);
                  else next.delete(contact);
                  return next;
                })
              }
            />
          )}
          {error && (
            <p role="alert" style={problemText(theme)}>
              {error}
            </p>
          )}
          <div style={footerStyle(theme)}>
            <Button
              theme={theme}
              variant="secondary"
              type="button"
              disabled={busy}
              onClick={backToEdit}
            >
              ← {t("back")}
            </Button>
            <span style={{ flex: 1 }} />
            <Button
              theme={theme}
              variant="primary"
              type="button"
              disabled={busy || reviewing || !currentReview || !selected.size}
              onClick={send}
            >
              {busy ? t("sending") : t("send", { count: selected.size })}
            </Button>
          </div>
        </>
      )}

      {step === "results" && (
        <>
          <div role="status" style={{ display: "grid", gap: "6px" }}>
            {sentCount > 0 && <strong>{t("resultSent", { count: sentCount })}</strong>}
            {failed.length > 0 && (
              <>
                <span>{t("resultFailed", { count: failed.length })}</span>
                <ul style={{ margin: 0, paddingLeft: "18px" }}>
                  {failed.map((row) => (
                    <li key={row.contact}>
                      {row.contact}: {t("failed")}
                      {row.error ? ` — ${row.error}` : ""}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div style={footerStyle(theme)}>
            <span style={{ flex: 1 }} />
            <Button
              theme={theme}
              variant="primary"
              type="button"
              onClick={() => {
                setResults([]);
                setStep("edit");
              }}
            >
              {t("continue")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
