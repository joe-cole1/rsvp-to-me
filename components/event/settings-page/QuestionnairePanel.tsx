"use client";

import { useTranslations } from "next-intl";

import { Plus, X } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import {
  QUESTIONNAIRE_TEMPLATES,
  formatRsvpAnswerForDisplay,
  type QuestionnaireTemplateId,
  type RsvpFieldTypeValue,
} from "@/lib/rsvp-fields";
import type { QuestionnaireResponseEntry, RsvpFieldEntry, SettingsOverrides } from "./types";
import { Section } from "./ui";
import { Button, buttonProps } from "@/components/ui/Button";
import { Check, Field, Input, Label, Select, Textarea } from "@/components/ui/Field";

export function QuestionnairePanel({
  rsvpEnabled = true,
  eventSlug,
  responses = [],
  fields,
  addingField,
  setAddingField,
  newFieldLabel,
  setNewFieldLabel,
  newFieldDescription = "",
  setNewFieldDescription,
  newFieldType,
  setNewFieldType,
  newFieldRequired,
  setNewFieldRequired,
  newFieldGoingOnly = false,
  setNewFieldGoingOnly,
  newFieldOptions,
  setNewFieldOptions,
  newTermsText = "",
  setNewTermsText,
  newTermsUrl = "",
  setNewTermsUrl,
  labelDrafts,
  setLabelDrafts,
  descriptionDrafts = {},
  setDescriptionDrafts,
  optionsDrafts,
  setOptionsDrafts,
  termsTextDrafts = {},
  setTermsTextDrafts,
  termsUrlDrafts = {},
  setTermsUrlDrafts,
  fieldTermsErrors = {},
  handleSelectTemplate,
  handleAddField,
  handleUpdateFieldType,
  handleUpdateFieldRequired,
  handleUpdateFieldGoingOnly,
  handleUpdateFieldLabel,
  handleUpdateFieldDescription,
  handleUpdateFieldOptions,
  handleUpdateFieldTerms,
  handleDeleteField,
  isPending,
  t,
}: {
  rsvpEnabled?: boolean;
  eventSlug?: string;
  responses?: QuestionnaireResponseEntry[];
  questionnaireEnabled: boolean;
  setQuestionnaireEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  fields: RsvpFieldEntry[];
  addingField: boolean;
  setAddingField: React.Dispatch<React.SetStateAction<boolean>>;
  newFieldLabel: string;
  setNewFieldLabel: React.Dispatch<React.SetStateAction<string>>;
  newFieldDescription?: string;
  setNewFieldDescription?: React.Dispatch<React.SetStateAction<string>>;
  newFieldType: RsvpFieldTypeValue;
  setNewFieldType: React.Dispatch<React.SetStateAction<RsvpFieldTypeValue>>;
  newFieldRequired: boolean;
  setNewFieldRequired: React.Dispatch<React.SetStateAction<boolean>>;
  newFieldGoingOnly?: boolean;
  setNewFieldGoingOnly?: React.Dispatch<React.SetStateAction<boolean>>;
  newFieldOptions: string;
  setNewFieldOptions: React.Dispatch<React.SetStateAction<string>>;
  newTermsText?: string;
  setNewTermsText?: React.Dispatch<React.SetStateAction<string>>;
  newTermsUrl?: string;
  setNewTermsUrl?: React.Dispatch<React.SetStateAction<string>>;
  labelDrafts: Record<string, string>;
  setLabelDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  descriptionDrafts?: Record<string, string>;
  setDescriptionDrafts?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  optionsDrafts: Record<string, string>;
  setOptionsDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  termsTextDrafts?: Record<string, string>;
  setTermsTextDrafts?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  termsUrlDrafts?: Record<string, string>;
  setTermsUrlDrafts?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  fieldTermsErrors?: Record<string, string>;
  handleSelectTemplate?: (templateId: QuestionnaireTemplateId) => void;
  handleAddField: () => void;
  handleUpdateFieldType: (fieldId: string, fieldType: RsvpFieldEntry["fieldType"]) => void;
  handleUpdateFieldRequired: (fieldId: string, required: boolean) => void;
  handleUpdateFieldGoingOnly?: (fieldId: string, goingOnly: boolean) => void;
  handleUpdateFieldLabel: (fieldId: string) => void;
  handleUpdateFieldDescription?: (fieldId: string) => void;
  handleUpdateFieldOptions: (fieldId: string) => void;
  handleUpdateFieldTerms?: (fieldId: string) => void;
  handleDeleteField: (fieldId: string) => void;
  triggerSaveSettings: (overrides: SettingsOverrides) => void;
  isPending: boolean;
  t: ResolvedTheme;
}) {
  const translate = useTranslations("Ui.Event.QuestionnairePanel");
  const common = useTranslations("Ui.Common");
  const block: React.CSSProperties = {
    border: `1px solid ${t.inputBorder}`,
    borderRadius: "12px",
    padding: "14px",
  };
  const checkLabel: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer",
    fontSize: "13px",
    color: t.textSecondary,
    whiteSpace: "nowrap",
  };
  const typeOptions = (
    <>
      <option value="TEXT">{translate("shortText")}</option>
      <option value="TEXTAREA">{translate("longText")}</option>
      <option value="SELECT">{translate("multipleChoice")}</option>
      <option value="CHECKBOX">{translate("checkboxes")}</option>
      <option value="PHONE">{translate("phoneNumber")}</option>
      <option value="ADDRESS">{translate("mailingAddress")}</option>
      <option value="TERMS">{translate("termsWaiver")}</option>
    </>
  );

  return (
    <Section title={translate("questionnaire")} t={t}>
      <div
        style={{
          fontSize: "13px",
          color: t.textSecondary,
          marginBottom: "16px",
          lineHeight: "1.5",
        }}
      >
        {rsvpEnabled
          ? translate("addCustomQuestionsGatherExtraInformation")
          : translate("addCustomQuestionsInfoOnly")}
      </div>

      {handleSelectTemplate && (
        <div style={{ marginBottom: "16px" }}>
          <Label theme={t} style={{ marginBottom: "8px" }}>
            {translate("quickAddTemplates")}
          </Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {QUESTIONNAIRE_TEMPLATES.map((tpl) => (
              <Button
                key={tpl.id}
                theme={t}
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => handleSelectTemplate(tpl.id)}
              >
                <Plus size={13} aria-hidden="true" />
                {translate(`templates.${tpl.id}.button`)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {fields.length > 0 && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {fields.map((f) => (
            <div key={f.id} style={block}>
              {/* Top row: type select + required + goingOnly + delete */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <Select
                  theme={t}
                  aria-label={translate("questionType")}
                  value={f.fieldType}
                  onChange={(e) =>
                    handleUpdateFieldType(f.id, e.target.value as RsvpFieldEntry["fieldType"])
                  }
                  style={{ flex: "1 1 160px", width: "auto" }}
                >
                  {typeOptions}
                </Select>
                <label style={checkLabel}>
                  <Check
                    theme={t}
                    checked={f.required}
                    onChange={(e) => handleUpdateFieldRequired(f.id, e.target.checked)}
                  />
                  {translate("required")}
                </label>
                {rsvpEnabled && handleUpdateFieldGoingOnly && (
                  <label style={checkLabel}>
                    <Check
                      theme={t}
                      checked={Boolean(f.goingOnly)}
                      onChange={(e) => handleUpdateFieldGoingOnly(f.id, e.target.checked)}
                    />
                    {translate("goingOnly")}
                  </label>
                )}
                <Button
                  theme={t}
                  variant="icon"
                  aria-label={`${common("remove")}: ${f.label}`}
                  onClick={() => handleDeleteField(f.id)}
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              </div>
              {/* Label input */}
              <Input
                theme={t}
                aria-label={translate("questionText")}
                value={labelDrafts[f.id] ?? f.label}
                onChange={(e) => setLabelDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                onBlur={() => handleUpdateFieldLabel(f.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                placeholder={translate("questionText")}
                style={{ marginBottom: "8px" }}
              />
              {/* Optional helper blurb */}
              {setDescriptionDrafts && handleUpdateFieldDescription && (
                <Input
                  theme={t}
                  aria-label={translate("descriptionLabel")}
                  maxLength={500}
                  value={descriptionDrafts[f.id] ?? f.description ?? ""}
                  onChange={(e) =>
                    setDescriptionDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                  onBlur={() => handleUpdateFieldDescription(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  placeholder={translate("descriptionPlaceholder")}
                  style={{
                    marginBottom:
                      f.fieldType === "SELECT" ||
                      f.fieldType === "CHECKBOX" ||
                      f.fieldType === "TERMS"
                        ? "8px"
                        : 0,
                  }}
                />
              )}
              {/* Options textarea for SELECT/CHECKBOX */}
              {(f.fieldType === "SELECT" || f.fieldType === "CHECKBOX") && (
                <Textarea
                  theme={t}
                  aria-label={translate("optionsOnePerLine")}
                  value={optionsDrafts[f.id] ?? f.options ?? ""}
                  onChange={(e) =>
                    setOptionsDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                  onBlur={() => handleUpdateFieldOptions(f.id)}
                  placeholder={translate("optionsOnePerLine")}
                  rows={3}
                />
              )}
              {/* Terms text + external link for TERMS */}
              {f.fieldType === "TERMS" && setTermsTextDrafts && setTermsUrlDrafts && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Field theme={t} label={translate("termsTextLabel")} style={{ marginBottom: 0 }}>
                    <Textarea
                      theme={t}
                      value={termsTextDrafts[f.id] ?? ""}
                      onChange={(e) =>
                        setTermsTextDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))
                      }
                      onBlur={() => handleUpdateFieldTerms?.(f.id)}
                      placeholder={translate("termsTextPlaceholder")}
                      rows={6}
                      style={{
                        resize: "vertical",
                        maxHeight: "220px",
                        overflowY: "auto",
                      }}
                    />
                  </Field>
                  <Field
                    theme={t}
                    label={translate("termsUrlLabel")}
                    error={fieldTermsErrors[f.id]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input
                      theme={t}
                      type="url"
                      value={termsUrlDrafts[f.id] ?? ""}
                      onChange={(e) =>
                        setTermsUrlDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))
                      }
                      onBlur={() => handleUpdateFieldTerms?.(f.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      placeholder={translate("termsUrlPlaceholder")}
                    />
                  </Field>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {addingField ? (
        <div
          style={{
            ...block,
            marginTop: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <Select
              theme={t}
              aria-label={translate("questionType")}
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value as typeof newFieldType)}
              style={{ flex: "1 1 160px", width: "auto" }}
            >
              {typeOptions}
            </Select>
            <label style={checkLabel}>
              <Check
                theme={t}
                checked={newFieldRequired}
                onChange={(e) => setNewFieldRequired(e.target.checked)}
              />
              {translate("required")}
            </label>
            {rsvpEnabled && setNewFieldGoingOnly && (
              <label style={checkLabel}>
                <Check
                  theme={t}
                  checked={newFieldGoingOnly}
                  onChange={(e) => setNewFieldGoingOnly(e.target.checked)}
                />
                {translate("goingOnly")}
              </label>
            )}
          </div>
          <Input
            theme={t}
            aria-label={translate("questionText2")}
            value={newFieldLabel}
            onChange={(e) => setNewFieldLabel(e.target.value)}
            placeholder={translate("questionText2")}
          />
          {setNewFieldDescription && (
            <Input
              theme={t}
              aria-label={translate("descriptionLabel")}
              maxLength={500}
              value={newFieldDescription}
              onChange={(e) => setNewFieldDescription(e.target.value)}
              placeholder={translate("descriptionPlaceholder")}
            />
          )}
          {(newFieldType === "SELECT" || newFieldType === "CHECKBOX") && (
            <Textarea
              theme={t}
              aria-label={translate("optionsOnePerLine")}
              value={newFieldOptions}
              onChange={(e) => setNewFieldOptions(e.target.value)}
              placeholder={translate("optionsOnePerLine")}
              rows={3}
            />
          )}
          {newFieldType === "TERMS" && setNewTermsText && setNewTermsUrl && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Field theme={t} label={translate("termsTextLabel")} style={{ marginBottom: 0 }}>
                <Textarea
                  theme={t}
                  value={newTermsText}
                  onChange={(e) => setNewTermsText(e.target.value)}
                  placeholder={translate("termsTextPlaceholder")}
                  rows={6}
                  style={{
                    resize: "vertical",
                    maxHeight: "220px",
                    overflowY: "auto",
                  }}
                />
              </Field>
              <Field
                theme={t}
                label={translate("termsUrlLabel")}
                error={fieldTermsErrors.new}
                style={{ marginBottom: 0 }}
              >
                <Input
                  theme={t}
                  type="url"
                  value={newTermsUrl}
                  onChange={(e) => setNewTermsUrl(e.target.value)}
                  placeholder={translate("termsUrlPlaceholder")}
                />
              </Field>
            </div>
          )}
          <div style={{ display: "flex", gap: "6px" }}>
            <Button
              theme={t}
              variant="primary"
              onClick={handleAddField}
              disabled={!newFieldLabel.trim() || isPending}
              style={{ flex: 1 }}
            >
              {translate("addQuestion")}
            </Button>
            <Button theme={t} variant="secondary" onClick={() => setAddingField(false)}>
              {translate("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          theme={t}
          variant="add"
          fullWidth
          onClick={() => setAddingField(true)}
          style={{ marginTop: "12px" }}
        >
          <Plus size={14} aria-hidden="true" /> {translate("addQuestion")}
        </Button>
      )}

      {(fields.length > 0 || responses.length > 0) && (
        <div
          style={{
            borderTop: `1px solid ${t.cardBorder}`,
            marginTop: "20px",
            paddingTop: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "12px",
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: t.textPrimary, margin: 0 }}>
              {translate("responsesHeading", { count: responses.length })}
            </h3>
            {eventSlug && responses.length > 0 && (
              <a
                href={`/e/${eventSlug}/questionnaire.csv`}
                {...buttonProps(t, { variant: "secondary", size: "sm" })}
              >
                {translate("downloadCsv")}
              </a>
            )}
          </div>
          {responses.length === 0 ? (
            <p style={{ fontSize: "13px", color: t.textSecondary, margin: 0 }}>
              {translate("noResponsesYet")}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {responses.map((entry) => {
                const answeredFields = fields
                  .map((field) => ({
                    field,
                    value: entry.answers[field.id],
                  }))
                  .filter((item) => Boolean(item.value?.trim()));
                return (
                  <div key={entry.id} style={block}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        marginBottom: answeredFields.length > 0 ? "8px" : 0,
                      }}
                    >
                      <span style={{ fontSize: "14px", fontWeight: 700, color: t.textPrimary }}>
                        {entry.respondentName}
                      </span>
                      <span style={{ fontSize: "12px", color: t.textMuted }}>
                        {entry.source === "standalone"
                          ? translate("responseSourceEventPage")
                          : translate("responseSourceRsvp")}
                      </span>
                    </div>
                    {answeredFields.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {answeredFields.map(({ field, value }) => (
                          <div
                            key={field.id}
                            style={{ fontSize: "13px", color: t.textSecondary, lineHeight: 1.45 }}
                          >
                            <strong style={{ color: t.textPrimary }}>{field.label}:</strong>{" "}
                            {formatRsvpAnswerForDisplay(field.fieldType, value, {
                              acceptedLabel: translate("termsAgreed"),
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
