"use client";

import { useTranslations } from "next-intl";
import { buttonProps } from "@/components/ui/Button";
import { Check, Field, Input, Label, Select, Textarea } from "@/components/ui/Field";
import type { ResolvedTheme } from "@/lib/theme";
import {
  ADDRESS_PART_LIMITS,
  TERMS_ACCEPTED_VALUE,
  hasAnyAddressField,
  isTermsAccepted,
  parseAddressAnswer,
  parseRsvpFieldOptions,
  parseTermsFieldConfig,
  serializeAddressDraft,
  type StructuredAddress,
} from "@/lib/rsvp-fields";

export type QuestionnaireFieldItem = {
  id: string;
  label: string;
  description?: string | null;
  fieldType: string;
  required: boolean;
  goingOnly?: boolean;
  options: string | null;
};

export function QuestionnaireFieldInput({
  field,
  value,
  onChange,
  error,
  subFieldErrors,
  onClearSubFieldError,
  theme: t,
  idPrefix = "question",
}: {
  field: QuestionnaireFieldItem;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  subFieldErrors?: Record<string, string>;
  onClearSubFieldError?: (part: keyof StructuredAddress) => void;
  theme: ResolvedTheme;
  idPrefix?: string;
}) {
  const translate = useTranslations("Ui.Rsvp.QuestionnaireFields");

  const requiredBadge = field.required ? (
    <span style={{ fontWeight: 400, marginLeft: "4px" }}>{translate("requiredMarker")}</span>
  ) : null;

  const descriptionNode = field.description?.trim() ? (
    <p
      style={{
        fontSize: "13px",
        lineHeight: "19px",
        color: t.textSecondary,
        margin: "0 0 10px",
      }}
    >
      {field.description}
    </p>
  ) : null;

  if (field.fieldType === "CHECKBOX") {
    const selected = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const toggleOption = (opt: string) => {
      const next = selected.includes(opt)
        ? selected.filter((item) => item !== opt)
        : [...selected, opt];
      onChange(next.join(","));
    };

    return (
      <div>
        <Label theme={t}>
          {field.label}
          {requiredBadge}
        </Label>
        {descriptionNode}
        <div
          role="group"
          aria-label={field.label}
          aria-describedby={error ? `${idPrefix}-${field.id}-error` : undefined}
          tabIndex={-1}
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
                aria-invalid={!!error || undefined}
                aria-describedby={error ? `${idPrefix}-${field.id}-error` : undefined}
                checked={selected.includes(opt)}
                onChange={() => toggleOption(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
        {error && (
          <p
            id={`${idPrefix}-${field.id}-error`}
            style={{ color: t.status.error.text, fontSize: "13px", margin: "6px 0 0" }}
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  if (field.fieldType === "ADDRESS") {
    const addr = parseAddressAnswer(value);
    const partRequired = field.required || hasAnyAddressField(addr);
    const updatePart = (part: keyof StructuredAddress, nextPartValue: string) => {
      const next: StructuredAddress = { ...addr, [part]: nextPartValue };
      onChange(serializeAddressDraft(next));
      onClearSubFieldError?.(part);
    };
    const subError = (part: keyof StructuredAddress) => subFieldErrors?.[`${field.id}:${part}`];

    return (
      <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
        <legend
          style={{
            display: "block",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: t.textSecondary,
            marginBottom: "8px",
            padding: 0,
          }}
        >
          {field.label}
          {requiredBadge}
        </legend>
        {descriptionNode}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Field
            theme={t}
            label={translate("addressLine1")}
            error={subError("line1")}
            style={{ marginBottom: 0 }}
          >
            <Input
              theme={t}
              autoComplete="address-line1"
              maxLength={ADDRESS_PART_LIMITS.line1}
              required={partRequired}
              placeholder={translate("addressLine1Placeholder")}
              value={addr.line1}
              onChange={(e) => updatePart("line1", e.target.value)}
            />
          </Field>
          <Field
            theme={t}
            label={translate("addressLine2Optional")}
            error={subError("line2")}
            style={{ marginBottom: 0 }}
          >
            <Input
              theme={t}
              autoComplete="address-line2"
              maxLength={ADDRESS_PART_LIMITS.line2}
              placeholder={translate("addressLine2Placeholder")}
              value={addr.line2}
              onChange={(e) => updatePart("line2", e.target.value)}
            />
          </Field>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "10px",
            }}
          >
            <Field
              theme={t}
              label={translate("addressCity")}
              error={subError("city")}
              style={{ marginBottom: 0 }}
            >
              <Input
                theme={t}
                autoComplete="address-level2"
                maxLength={ADDRESS_PART_LIMITS.city}
                required={partRequired}
                value={addr.city}
                onChange={(e) => updatePart("city", e.target.value)}
              />
            </Field>
            <Field
              theme={t}
              label={translate("addressRegionOptional")}
              error={subError("region")}
              style={{ marginBottom: 0 }}
            >
              <Input
                theme={t}
                autoComplete="address-level1"
                maxLength={ADDRESS_PART_LIMITS.region}
                value={addr.region}
                onChange={(e) => updatePart("region", e.target.value)}
              />
            </Field>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "10px",
            }}
          >
            <Field
              theme={t}
              label={translate("addressPostalCode")}
              error={subError("postalCode")}
              style={{ marginBottom: 0 }}
            >
              <Input
                theme={t}
                autoComplete="postal-code"
                maxLength={ADDRESS_PART_LIMITS.postalCode}
                required={partRequired}
                value={addr.postalCode}
                onChange={(e) => updatePart("postalCode", e.target.value)}
              />
            </Field>
            <Field
              theme={t}
              label={translate("addressCountryOptional")}
              error={subError("country")}
              style={{ marginBottom: 0 }}
            >
              <Input
                theme={t}
                autoComplete="country-name"
                maxLength={ADDRESS_PART_LIMITS.country}
                value={addr.country}
                onChange={(e) => updatePart("country", e.target.value)}
              />
            </Field>
          </div>
        </div>
        {error && !subError("line1") && !subError("city") && !subError("postalCode") && (
          <p
            id={`${idPrefix}-${field.id}-error`}
            style={{ color: t.status.error.text, fontSize: "13px", margin: "6px 0 0" }}
          >
            {error}
          </p>
        )}
      </fieldset>
    );
  }

  if (field.fieldType === "TERMS") {
    const terms = parseTermsFieldConfig(field.options);
    return (
      <div>
        <Label theme={t}>
          {field.label}
          {requiredBadge}
        </Label>
        {descriptionNode}
        {terms.text && (
          <div
            role="region"
            aria-label={field.label}
            tabIndex={0}
            className="rsvp-control"
            style={
              {
                "--rsvp-focus": t.accent,
                maxHeight: "180px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                padding: "12px 14px",
                borderRadius: "10px",
                backgroundColor: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                color: t.textPrimary,
                fontSize: "13px",
                lineHeight: 1.55,
                marginBottom: "10px",
              } as React.CSSProperties
            }
          >
            {terms.text}
          </div>
        )}
        {terms.url && (
          <p style={{ margin: "0 0 10px", fontSize: "13px" }}>
            <a
              href={terms.url}
              target="_blank"
              rel="noopener noreferrer"
              {...buttonProps(t, { variant: "link" })}
            >
              {translate("readFullTerms")} ↗
            </a>
          </p>
        )}
        <label
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
            required={field.required}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${idPrefix}-${field.id}-error` : undefined}
            checked={isTermsAccepted(value)}
            onChange={(e) => onChange(e.target.checked ? TERMS_ACCEPTED_VALUE : "")}
          />
          <span>{translate("agreeToTerms", { label: field.label })}</span>
        </label>
        {error && (
          <p
            id={`${idPrefix}-${field.id}-error`}
            style={{ color: t.status.error.text, fontSize: "13px", margin: "6px 0 0" }}
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <Field
      theme={t}
      label={
        <>
          {field.label}
          {requiredBadge}
        </>
      }
      hint={field.description?.trim() || undefined}
      error={error}
      style={{ marginBottom: 0 }}
    >
      {field.fieldType === "TEXTAREA" ? (
        <Textarea
          theme={t}
          style={{ resize: "none" }}
          rows={3}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.fieldType === "SELECT" ? (
        <Select
          theme={t}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{translate("selectPlaceholder")}</option>
          {parseRsvpFieldOptions(field.options).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      ) : field.fieldType === "PHONE" ? (
        <Input
          theme={t}
          type="tel"
          autoComplete="tel"
          maxLength={30}
          placeholder={translate("phonePlaceholder")}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          theme={t}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
