"use client";

import { useTranslations } from "next-intl";

import { Plus, X } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import type { QuestionnaireResponseEntry, RsvpFieldEntry, SettingsOverrides } from "./types";
import { Section } from "./ui";
import { Button, buttonProps } from "@/components/ui/Button";
import { Check, Input, Select, Textarea } from "@/components/ui/Field";

export function QuestionnairePanel({
  rsvpEnabled = true,
  eventSlug,
  responses = [],
  fields,
  addingField,
  setAddingField,
  newFieldLabel,
  setNewFieldLabel,
  newFieldType,
  setNewFieldType,
  newFieldRequired,
  setNewFieldRequired,
  newFieldOptions,
  setNewFieldOptions,
  labelDrafts,
  setLabelDrafts,
  optionsDrafts,
  setOptionsDrafts,
  handleAddField,
  handleUpdateFieldType,
  handleUpdateFieldRequired,
  handleUpdateFieldLabel,
  handleUpdateFieldOptions,
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
  newFieldType: "TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX";
  setNewFieldType: React.Dispatch<
    React.SetStateAction<"TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX">
  >;
  newFieldRequired: boolean;
  setNewFieldRequired: React.Dispatch<React.SetStateAction<boolean>>;
  newFieldOptions: string;
  setNewFieldOptions: React.Dispatch<React.SetStateAction<string>>;
  labelDrafts: Record<string, string>;
  setLabelDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  optionsDrafts: Record<string, string>;
  setOptionsDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleAddField: () => void;
  handleUpdateFieldType: (fieldId: string, fieldType: RsvpFieldEntry["fieldType"]) => void;
  handleUpdateFieldRequired: (fieldId: string, required: boolean) => void;
  handleUpdateFieldLabel: (fieldId: string) => void;
  handleUpdateFieldOptions: (fieldId: string) => void;
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
  const requiredLabel: React.CSSProperties = {
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

      {fields.length > 0 && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {fields.map((f) => (
            <div key={f.id} style={block}>
              {/* Top row: type select + required + delete */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <Select
                  theme={t}
                  aria-label={translate("questionText")}
                  value={f.fieldType}
                  onChange={(e) =>
                    handleUpdateFieldType(f.id, e.target.value as RsvpFieldEntry["fieldType"])
                  }
                  style={{ flex: 1, width: "auto" }}
                >
                  {typeOptions}
                </Select>
                <label style={requiredLabel}>
                  <Check
                    theme={t}
                    checked={f.required}
                    onChange={(e) => handleUpdateFieldRequired(f.id, e.target.checked)}
                  />
                  {translate("required")}
                </label>
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
                style={{
                  marginBottom: f.fieldType === "SELECT" || f.fieldType === "CHECKBOX" ? "8px" : 0,
                }}
              />
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Select
              theme={t}
              aria-label={translate("questionText2")}
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value as typeof newFieldType)}
              style={{ flex: 1, width: "auto" }}
            >
              {typeOptions}
            </Select>
            <label style={requiredLabel}>
              <Check
                theme={t}
                checked={newFieldRequired}
                onChange={(e) => setNewFieldRequired(e.target.checked)}
              />
              {translate("required")}
            </label>
          </div>
          <Input
            theme={t}
            aria-label={translate("questionText2")}
            value={newFieldLabel}
            onChange={(e) => setNewFieldLabel(e.target.value)}
            placeholder={translate("questionText2")}
          />
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
                            {field.fieldType === "CHECKBOX"
                              ? value
                                  .split(",")
                                  .map((v) => v.trim())
                                  .filter(Boolean)
                                  .join(", ")
                              : value}
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
