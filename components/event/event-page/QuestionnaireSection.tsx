"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Settings } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import { validateQuestionnaireFieldsClient, type StructuredAddress } from "@/lib/rsvp-fields";
import { QuestionnaireFieldInput } from "@/components/rsvp/QuestionnaireFieldInput";
import { submitQuestionnaireResponse } from "@/app/actions/event";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import { Button, buttonProps } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
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
  const [subFieldErrors, setSubFieldErrors] = useState<Record<string, string>>({});
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
  }, [fieldErrors, subFieldErrors]);

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

  const clearAddressSubFieldError = (fieldId: string, part: keyof StructuredAddress) => {
    const key = `${fieldId}:${part}`;
    setSubFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      const prefix = `${fieldId}:`;
      if (!Object.keys(next).some((k) => k.startsWith(prefix))) {
        setFieldErrors((prevFields) => {
          if (!prevFields[fieldId]) return prevFields;
          const nextFields = { ...prevFields };
          delete nextFields[fieldId];
          return nextFields;
        });
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSavedNotice(false);

    const validation = validateQuestionnaireFieldsClient(event.rsvpFields, answers, {
      questionnaireFieldRequired: translate("requiredFieldError"),
      questionnaireInvalidOption: translate("invalidOptionError"),
      invalidPhone: translate("invalidPhoneError"),
      addressIncomplete: translate("addressIncompleteError"),
      termsRequired: translate("termsRequiredError"),
    });
    const errors = { ...validation.fieldErrors };
    if (!hasSessionName && !voterNameDraft.trim()) {
      errors.respondentName = translate("nameRequiredError");
    }
    if (Object.keys(errors).length > 0 || Object.keys(validation.subFieldErrors).length > 0) {
      focusInvalidRef.current = true;
      setFieldErrors(errors);
      setSubFieldErrors(validation.subFieldErrors);
      return;
    }

    setFieldErrors({});
    setSubFieldErrors({});
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
                <QuestionnaireFieldInput
                  field={field}
                  value={answers[field.id] ?? ""}
                  onChange={(val) => setAnswerValue(field.id, val)}
                  error={fieldErrors[field.id]}
                  subFieldErrors={subFieldErrors}
                  onClearSubFieldError={(part) => clearAddressSubFieldError(field.id, part)}
                  theme={t}
                  idPrefix="event-question"
                />
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
