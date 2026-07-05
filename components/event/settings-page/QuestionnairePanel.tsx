"use client";

import { Plus, X } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import type { RsvpFieldEntry, SettingsOverrides } from "./types";
import type { SettingsPageStyles } from "./styles";
import { Section } from "./ui";

export function QuestionnairePanel({
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
  S,
}: {
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
  S: SettingsPageStyles;
}) {
  return (
    <Section title="Questionnaire" t={t}>
      <div
        style={{
          fontSize: "13px",
          color: t.textSecondary,
          marginBottom: "16px",
          lineHeight: "1.5",
        }}
      >
        Add custom questions to gather extra information from guests (e.g., dietary restrictions,
        song requests). The questionnaire is automatically enabled and presented during the RSVP
        flow when one or more questions are added here.
      </div>

      {fields.length > 0 && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {fields.map((f) => (
            <div
              key={f.id}
              style={{
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                borderRadius: "14px",
                padding: "14px",
              }}
            >
              {/* Top row: type select + required + delete */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <select
                  value={f.fieldType}
                  onChange={(e) =>
                    handleUpdateFieldType(f.id, e.target.value as RsvpFieldEntry["fieldType"])
                  }
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    background: t.cardBg,
                    border: `1px solid ${t.inputBorder}`,
                    borderRadius: "8px",
                    color: t.textPrimary,
                    fontFamily: "inherit",
                    fontSize: "12px",
                    cursor: "pointer",
                    colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light",
                  }}
                >
                  <option value="TEXT">Short text</option>
                  <option value="TEXTAREA">Long text</option>
                  <option value="SELECT">Multiple choice</option>
                  <option value="CHECKBOX">Checkboxes</option>
                </select>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: t.textSecondary,
                    whiteSpace: "nowrap",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => handleUpdateFieldRequired(f.id, e.target.checked)}
                    style={{ accentColor: t.accent }}
                  />
                  Required
                </label>
                <button
                  onClick={() => handleDeleteField(f.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: t.textMuted,
                    padding: "4px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={15} />
                </button>
              </div>
              {/* Label input */}
              <input
                value={labelDrafts[f.id] ?? f.label}
                onChange={(e) => setLabelDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                onBlur={() => handleUpdateFieldLabel(f.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                placeholder="Question text"
                style={{
                  ...S.inp,
                  marginBottom: f.fieldType === "SELECT" || f.fieldType === "CHECKBOX" ? "8px" : 0,
                }}
              />
              {/* Options textarea for SELECT/CHECKBOX */}
              {(f.fieldType === "SELECT" || f.fieldType === "CHECKBOX") && (
                <textarea
                  value={optionsDrafts[f.id] ?? f.options ?? ""}
                  onChange={(e) =>
                    setOptionsDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                  onBlur={() => handleUpdateFieldOptions(f.id)}
                  placeholder="Options, one per line"
                  style={{ ...S.inp, resize: "none", marginTop: "4px" } as React.CSSProperties}
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
            marginTop: "12px",
            background: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: "14px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <select
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value as typeof newFieldType)}
              style={{
                flex: 1,
                padding: "6px 10px",
                background: t.cardBg,
                border: `1px solid ${t.inputBorder}`,
                borderRadius: "8px",
                color: t.textPrimary,
                fontFamily: "inherit",
                fontSize: "12px",
                cursor: "pointer",
                colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light",
              }}
            >
              <option value="TEXT">Short text</option>
              <option value="TEXTAREA">Long text</option>
              <option value="SELECT">Multiple choice</option>
              <option value="CHECKBOX">Checkboxes</option>
            </select>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
                fontSize: "12px",
                color: t.textSecondary,
                whiteSpace: "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={newFieldRequired}
                onChange={(e) => setNewFieldRequired(e.target.checked)}
                style={{ accentColor: t.accent }}
              />
              Required
            </label>
          </div>
          <input
            value={newFieldLabel}
            onChange={(e) => setNewFieldLabel(e.target.value)}
            placeholder="Question text *"
            style={S.inp}
          />
          {(newFieldType === "SELECT" || newFieldType === "CHECKBOX") && (
            <textarea
              value={newFieldOptions}
              onChange={(e) => setNewFieldOptions(e.target.value)}
              placeholder="Options, one per line"
              style={{ ...S.inp, resize: "none" } as React.CSSProperties}
              rows={3}
            />
          )}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={handleAddField}
              disabled={!newFieldLabel.trim() || isPending}
              style={{ ...S.smallBtn, flex: 1 }}
            >
              Add Question
            </button>
            <button
              onClick={() => setAddingField(false)}
              style={{
                ...S.smallBtn,
                background: t.inputBg,
                color: t.textSecondary,
                border: `1px solid ${t.inputBorder}`,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingField(true)}
          style={{
            marginTop: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: t.inputBg,
            border: `1px dashed ${t.accentBorder}`,
            borderRadius: "10px",
            padding: "10px 14px",
            color: t.textMuted,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "13px",
            width: "100%",
          }}
        >
          <Plus size={14} /> Add Question
        </button>
      )}
    </Section>
  );
}
