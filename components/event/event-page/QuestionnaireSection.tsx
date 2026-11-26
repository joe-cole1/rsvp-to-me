"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Settings } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import { parseRsvpFieldOptions } from "@/lib/rsvp-fields";
import { submitQuestionnaireResponse } from "@/app/actions/event";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import { Button, buttonProps } from "@/components/ui/Button";
import { Check, Field, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/Feedback";
import { EventCard } from "./EventCard";
import type { EventData } from "./types";

export type ViewerQuestionnaireSubmission = {
  respondentName: string;
  updatedAt: string;
  answers: Record<string, string>;
};

export function QuestionnaireSection({
  event,
  t,
  isHost,
  initialSubmission = null,
  hasSessionName = false,
  voterNameDraft = "",
  setVoterNameDraft,
}: {
  event: EventData;
  t: ResolvedTheme;
  isHost: boolean;
  initialSubmission?: ViewerQuestionnaireSubmission | null;
  hasSessionName?: boolean;
  voterNameDraft?: string;
  setVoterNameDraft?: React.Dispatch<React.SetStateAction<string>>;
}) {
  const translate = useTranslations("Ui.Event.QuestionnaireSection");
  const { runWithCaptcha } = useCaptcha();
  const [isPending, startTransition] = useTransition();

  const [answers, setAnswers] = useState<Record<string, string>>(
    () => initialSubmission?.answers ?? {}
  );
  const [savedAt, setSavedAt] = useState<string | null>(initialSubmission?.updatedAt ?? null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const focusInvalidRef = useRef(false);

  useEffect(() => {
    if (!focusInvalidRef.current) return;
    focusInvalidRef.current = false;
    const firstInvalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    firstInvalid?.focus();
  }, [fieldErrors]);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  if (event.rsvpEnabled !== false || event.rsvpFields.length === 0) return null;

  const setAnswerValue = (fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setSavedNotice(false);
    setFieldErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  const toggleCheckbox = (fieldId: string, option: string) => {
    const current = (answers[fieldId] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    setAnswerValue(fieldId, next.join(","));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSavedNotice(false);

    const errors: Record<string, string> = {};
    if (!hasSessionName && !voterNameDraft.trim()) {
      errors.respondentName = translate("nameRequiredError");
    }
    for (const field of event.rsvpFields) {
      if (field.required && !(answers[field.id] ?? "").trim()) {
        errors[field.id] = translate("requiredFieldError");
      }
    }
    if (Object.keys(errors).length > 0) {
      focusInvalidRef.current = true;
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    startTransition(async () => {
      try {
        const result = await runWithCaptcha("questionnaire_submit", (token) =>
          submitQuestionnaireResponse(
            {
              eventId: event.id,
              respondentName: voterNameDraft.trim(),
              answers,
            },
            token
          )
        );
        if (!result.success) {
          if ("fieldErrors" in result && result.fieldErrors) {
            focusInvalidRef.current = true;
            setFieldErrors(result.fieldErrors);
          }
          setFormError(result.error ?? translate("submitFailed"));
          return;
        }
        setAnswers(result.answers);
        setSavedAt(result.updatedAt);
        setSavedNotice(true);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : translate("submitFailed"));
      }
    });
  };

  return (
    <EventCard id="questionnaire" theme={t}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <ClipboardList size={16} style={{ color: t.accent }} aria-hidden="true" />
          <span style={{ fontWeight: 700 }}>{translate("title")}</span>
        </div>
        {isHost && (
          <a
            href={`/e/${event.slug}/settings?section=questionnaire`}
            aria-label={translate("manageQuestions")}
            title={translate("manageQuestions")}
            {...buttonProps(t, { variant: "icon" })}
          >
            <Settings size={14} aria-hidden="true" />
          </a>
        )}
      </div>

      {isHost ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <p style={{ fontSize: "13px", color: t.textSecondary, margin: 0, lineHeight: 1.5 }}>
            {translate("hostPreviewHint")}
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "13px",
              color: t.textPrimary,
            }}
          >
            {event.rsvpFields.map((field) => (
              <li key={field.id}>
                {field.label}
                {field.required ? ` ${translate("requiredMarker")}` : ""}
              </li>
            ))}
          </ul>
          <div>
            <a
              href={`/e/${event.slug}/settings?section=questionnaire`}
              {...buttonProps(t, { variant: "secondary", size: "sm" })}
            >
              {translate("viewResponses")}
            </a>
          </div>
        </div>
      ) : (
        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <p
            style={{
              fontSize: "13px",
              color: t.textSecondary,
              margin: "0 0 14px",
              lineHeight: 1.5,
            }}
          >
            {translate("onlyHostCanSeeAnswers")}
          </p>

          {!hasSessionName && setVoterNameDraft && (
            <Field
              theme={t}
              label={translate("yourName")}
              error={fieldErrors.respondentName}
              style={{ marginBottom: "14px" }}
            >
              <Input
                theme={t}
                required
                value={voterNameDraft}
                onChange={(e) => {
                  setVoterNameDraft(e.target.value);
                  setSavedNotice(false);
                  setFieldErrors((prev) => {
                    if (!prev.respondentName) return prev;
                    const next = { ...prev };
                    delete next.respondentName;
                    return next;
                  });
                }}
                placeholder={translate("yourNamePlaceholder")}
              />
            </Field>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {event.rsvpFields.map((field) => (
              <div key={field.id}>
                {field.fieldType === "CHECKBOX" ? (
                  <>
                    <Label theme={t}>
                      {field.label}
                      {field.required && (
                        <span style={{ fontWeight: 400, marginLeft: "4px" }}>
                          {translate("requiredMarker")}
                        </span>
                      )}
                    </Label>
                    <div
                      role="group"
                      aria-label={field.label}
                      aria-describedby={
                        fieldErrors[field.id] ? `event-question-${field.id}-error` : undefined
                      }
                      style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                    >
                      {parseRsvpFieldOptions(field.options).map((opt) => (
                        <label
                          key={opt}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            cursor: "pointer",
                            fontSize: "14px",
                            color: t.textPrimary,
                          }}
                        >
                          <Check
                            theme={t}
                            aria-invalid={!!fieldErrors[field.id] || undefined}
                            aria-describedby={
                              fieldErrors[field.id] ? `event-question-${field.id}-error` : undefined
                            }
                            checked={(answers[field.id] ?? "")
                              .split(",")
                              .map((s) => s.trim())
                              .includes(opt)}
                            onChange={() => toggleCheckbox(field.id, opt)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                    {fieldErrors[field.id] && (
                      <p
                        id={`event-question-${field.id}-error`}
                        style={{ color: t.status.error.text, fontSize: "13px", margin: "6px 0 0" }}
                      >
                        {fieldErrors[field.id]}
                      </p>
                    )}
                  </>
                ) : (
                  <Field
                    theme={t}
                    label={
                      <>
                        {field.label}
                        {field.required && (
                          <span style={{ fontWeight: 400, marginLeft: "4px" }}>
                            {translate("requiredMarker")}
                          </span>
                        )}
                      </>
                    }
                    error={fieldErrors[field.id]}
                    style={{ marginBottom: 0 }}
                  >
                    {field.fieldType === "TEXTAREA" ? (
                      <Textarea
                        theme={t}
                        rows={3}
                        style={{ resize: "none" }}
                        required={field.required}
                        value={answers[field.id] ?? ""}
                        onChange={(e) => setAnswerValue(field.id, e.target.value)}
                      />
                    ) : field.fieldType === "SELECT" ? (
                      <Select
                        theme={t}
                        required={field.required}
                        value={answers[field.id] ?? ""}
                        onChange={(e) => setAnswerValue(field.id, e.target.value)}
                      >
                        <option value="">{translate("selectPlaceholder")}</option>
                        {parseRsvpFieldOptions(field.options).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        theme={t}
                        required={field.required}
                        value={answers[field.id] ?? ""}
                        onChange={(e) => setAnswerValue(field.id, e.target.value)}
                      />
                    )}
                  </Field>
                )}
              </div>
            ))}
          </div>

          {Object.keys(fieldErrors).length > 0 && (
            <InlineAlert theme={t} tone="error" style={{ marginTop: "12px", marginBottom: 0 }}>
              {translate("checkFields")}
            </InlineAlert>
          )}
          {formError && (
            <div ref={errorRef} tabIndex={-1} style={{ marginTop: "12px" }}>
              <InlineAlert theme={t} tone="error" style={{ marginBottom: 0 }}>
                {formError}
              </InlineAlert>
            </div>
          )}
          {savedNotice && (
            <InlineAlert theme={t} tone="success" style={{ marginTop: "12px", marginBottom: 0 }}>
              {translate("answersSaved")}
            </InlineAlert>
          )}

          <div style={{ marginTop: "14px" }}>
            <Button theme={t} variant="primary" type="submit" disabled={isPending}>
              {isPending
                ? translate("saving")
                : savedAt
                  ? translate("updateAnswers")
                  : translate("submitAnswers")}
            </Button>
          </div>
        </form>
      )}
    </EventCard>
  );
}
