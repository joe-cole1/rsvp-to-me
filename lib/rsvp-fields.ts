export const RSVP_FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "SELECT",
  "CHECKBOX",
  "PHONE",
  "ADDRESS",
  "TERMS",
] as const;

export type RsvpFieldTypeValue = (typeof RSVP_FIELD_TYPES)[number];

export type StructuredAddress = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export const EMPTY_STRUCTURED_ADDRESS: StructuredAddress = {
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
};

export const ADDRESS_PART_LIMITS: Record<keyof StructuredAddress, number> = {
  line1: 200,
  line2: 200,
  city: 100,
  region: 100,
  postalCode: 30,
  country: 100,
};

export type TermsFieldConfig = {
  text: string;
  url: string;
};

export const TERMS_ACCEPTED_VALUE = "ACCEPTED";

export const QUESTIONNAIRE_PHONE_REGEX = /^\+?[0-9\s\-().]{7,}$/;

export const QUESTIONNAIRE_TEMPLATE_IDS = [
  "address",
  "phone",
  "dietary",
  "emergencyContact",
  "accessibility",
  "terms",
] as const;

export type QuestionnaireTemplateId = (typeof QUESTIONNAIRE_TEMPLATE_IDS)[number];

export type QuestionnaireTemplateSpec = {
  id: QuestionnaireTemplateId;
  fieldType: RsvpFieldTypeValue;
  required: boolean;
  goingOnly: boolean;
  hasDescription: boolean;
  hasOptionsList?: boolean;
};

export const QUESTIONNAIRE_TEMPLATES: readonly QuestionnaireTemplateSpec[] = [
  { id: "address", fieldType: "ADDRESS", required: false, goingOnly: true, hasDescription: false },
  { id: "phone", fieldType: "PHONE", required: false, goingOnly: true, hasDescription: true },
  {
    id: "dietary",
    fieldType: "CHECKBOX",
    required: false,
    goingOnly: true,
    hasDescription: false,
    hasOptionsList: true,
  },
  {
    id: "emergencyContact",
    fieldType: "TEXT",
    required: false,
    goingOnly: true,
    hasDescription: true,
  },
  {
    id: "accessibility",
    fieldType: "TEXTAREA",
    required: false,
    goingOnly: true,
    hasDescription: false,
  },
  { id: "terms", fieldType: "TERMS", required: true, goingOnly: true, hasDescription: true },
];

/** Parse options configured on a SELECT or CHECKBOX questionnaire field. */
export function parseRsvpFieldOptions(optionsStr: string | null | undefined): string[] {
  if (!optionsStr) return [];
  try {
    const parsed = JSON.parse(optionsStr);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    // Fall back to newline splitting
  }
  return optionsStr
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse structured mailing address JSON stored in an answer value. */
export function parseAddressAnswer(raw: string | null | undefined): StructuredAddress {
  if (!raw) return { ...EMPTY_STRUCTURED_ADDRESS };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      return {
        line1: typeof obj.line1 === "string" ? obj.line1 : "",
        line2: typeof obj.line2 === "string" ? obj.line2 : "",
        city: typeof obj.city === "string" ? obj.city : "",
        region: typeof obj.region === "string" ? obj.region : "",
        postalCode: typeof obj.postalCode === "string" ? obj.postalCode : "",
        country: typeof obj.country === "string" ? obj.country : "",
      };
    }
  } catch {
    // Fall back to putting plain legacy text in line1
  }
  const trimmed = raw.trim();
  return trimmed
    ? { ...EMPTY_STRUCTURED_ADDRESS, line1: trimmed }
    : { ...EMPTY_STRUCTURED_ADDRESS };
}

/** Serialize a structured address into compact JSON, or "" when every part is blank. */
export function serializeAddressAnswer(addr: Partial<StructuredAddress>): string {
  const clean: Partial<StructuredAddress> = {};
  const keys: (keyof StructuredAddress)[] = [
    "line1",
    "line2",
    "city",
    "region",
    "postalCode",
    "country",
  ];
  for (const key of keys) {
    const val = typeof addr[key] === "string" ? addr[key]!.trim() : "";
    if (val) clean[key] = val;
  }
  return Object.keys(clean).length === 0 ? "" : JSON.stringify(clean);
}

/** Serialize an in-progress address draft without trimming spaces while typing. */
export function serializeAddressDraft(addr: StructuredAddress): string {
  return hasAnyAddressField(addr) ? JSON.stringify(addr) : "";
}

export function hasAnyAddressField(addr: StructuredAddress): boolean {
  return Boolean(
    addr.line1.trim() ||
    addr.line2.trim() ||
    addr.city.trim() ||
    addr.region.trim() ||
    addr.postalCode.trim() ||
    addr.country.trim()
  );
}

/** International-friendly completeness: street line 1, city, and postal code are required; apt/region/country are optional. */
export function isAddressComplete(addr: StructuredAddress): boolean {
  return Boolean(addr.line1.trim() && addr.city.trim() && addr.postalCode.trim());
}

export function formatAddressDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const addr = parseAddressAnswer(raw);
  const locality = [addr.city.trim(), addr.region.trim(), addr.postalCode.trim()]
    .filter(Boolean)
    .join(", ");
  return [addr.line1.trim(), addr.line2.trim(), locality, addr.country.trim()]
    .filter(Boolean)
    .join(", ");
}

/** Parse terms text and optional external link JSON stored in RSVPField.options for TERMS fields. */
export function parseTermsFieldConfig(optionsStr: string | null | undefined): TermsFieldConfig {
  if (!optionsStr) return { text: "", url: "" };
  try {
    const parsed = JSON.parse(optionsStr);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      return {
        text: typeof obj.text === "string" ? obj.text : "",
        url: typeof obj.url === "string" ? obj.url : "",
      };
    }
  } catch {
    // Not JSON object
  }
  return { text: "", url: "" };
}

export function serializeTermsFieldConfig(config: {
  text?: string | null;
  url?: string | null;
}): string | null {
  const text = (config.text ?? "").trim();
  const url = (config.url ?? "").trim();
  if (!text && !url) return null;
  return JSON.stringify({
    ...(text ? { text } : {}),
    ...(url ? { url } : {}),
  });
}

export function isTermsAccepted(raw: string | null | undefined): boolean {
  return (raw ?? "").trim() === TERMS_ACCEPTED_VALUE;
}

export function isFieldVisibleForRsvpStatus(
  field: { goingOnly?: boolean | null },
  status: "GOING" | "MAYBE" | "NO"
): boolean {
  if (status === "NO") return false;
  if (status === "GOING") return true;
  return !field.goingOnly;
}

export type FieldAnswerValidationResult =
  | { valid: true; normalized: string | null }
  | {
      valid: false;
      reason:
        | "questionnaireFieldRequired"
        | "questionnaireInvalidOption"
        | "invalidPhone"
        | "addressIncomplete"
        | "termsRequired";
    };

export function validateRsvpFieldAnswer(
  field: { fieldType?: string | null; required?: boolean | null; options?: string | null },
  rawValue: string | undefined
): FieldAnswerValidationResult {
  const fieldType = field.fieldType ?? "TEXT";
  const required = Boolean(field.required);
  const raw = (rawValue ?? "").trim();

  if (fieldType === "CHECKBOX") {
    const selected = Array.from(
      new Set(
        raw
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      )
    );
    const allowed = new Set(parseRsvpFieldOptions(field.options));
    if (allowed.size > 0 && selected.some((item) => !allowed.has(item))) {
      return { valid: false, reason: "questionnaireInvalidOption" };
    }
    if (required && selected.length === 0) {
      return { valid: false, reason: "questionnaireFieldRequired" };
    }
    return { valid: true, normalized: selected.length > 0 ? selected.join(",") : null };
  }

  if (fieldType === "SELECT") {
    const allowed = new Set(parseRsvpFieldOptions(field.options));
    if (required && !raw) {
      return { valid: false, reason: "questionnaireFieldRequired" };
    }
    if (raw) {
      if (allowed.size > 0 && !allowed.has(raw)) {
        return { valid: false, reason: "questionnaireInvalidOption" };
      }
      return { valid: true, normalized: raw };
    }
    return { valid: true, normalized: null };
  }

  if (fieldType === "PHONE") {
    if (!raw) {
      return required
        ? { valid: false, reason: "questionnaireFieldRequired" }
        : { valid: true, normalized: null };
    }
    if (raw.length > 30 || !QUESTIONNAIRE_PHONE_REGEX.test(raw)) {
      return { valid: false, reason: "invalidPhone" };
    }
    return { valid: true, normalized: raw };
  }

  if (fieldType === "ADDRESS") {
    const addr = parseAddressAnswer(rawValue);
    if (!hasAnyAddressField(addr)) {
      return required
        ? { valid: false, reason: "questionnaireFieldRequired" }
        : { valid: true, normalized: null };
    }
    for (const [part, limit] of Object.entries(ADDRESS_PART_LIMITS) as [
      keyof StructuredAddress,
      number,
    ][]) {
      if (addr[part].trim().length > limit) {
        return { valid: false, reason: "addressIncomplete" };
      }
    }
    if (!isAddressComplete(addr)) {
      return { valid: false, reason: "addressIncomplete" };
    }
    const serialized = serializeAddressAnswer(addr);
    return serialized
      ? { valid: true, normalized: serialized }
      : { valid: false, reason: "addressIncomplete" };
  }

  if (fieldType === "TERMS") {
    if (isTermsAccepted(raw)) {
      return { valid: true, normalized: TERMS_ACCEPTED_VALUE };
    }
    return required ? { valid: false, reason: "termsRequired" } : { valid: true, normalized: null };
  }

  if (required && !raw) {
    return { valid: false, reason: "questionnaireFieldRequired" };
  }
  return { valid: true, normalized: raw || null };
}

export function formatRsvpAnswerForDisplay(
  fieldType: string | null | undefined,
  value: string,
  options?: { acceptedLabel?: string }
): string {
  if (fieldType === "ADDRESS") {
    return formatAddressDisplay(value);
  }
  if (fieldType === "TERMS") {
    return isTermsAccepted(value) ? (options?.acceptedLabel ?? "Agreed") : value;
  }
  if (fieldType === "CHECKBOX") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .join(", ");
  }
  return value;
}

export type QuestionnaireCsvColumn = {
  header: string;
  extract: (answersByFieldId: Map<string, string>) => string;
};

export function buildQuestionnaireCsvColumns(
  fields: { id: string; label: string; fieldType?: string | null }[],
  acceptedLabel = "Agreed"
): QuestionnaireCsvColumn[] {
  const labelCounts = new Map<string, number>();
  const columns: QuestionnaireCsvColumn[] = [];

  for (const field of fields) {
    const count = (labelCounts.get(field.label) ?? 0) + 1;
    labelCounts.set(field.label, count);
    const base = count === 1 ? field.label : `${field.label} (${count})`;

    if (field.fieldType === "ADDRESS") {
      columns.push(
        {
          header: `${base} - Street`,
          extract: (answers) => parseAddressAnswer(answers.get(field.id)).line1.trim(),
        },
        {
          header: `${base} - Line 2`,
          extract: (answers) => parseAddressAnswer(answers.get(field.id)).line2.trim(),
        },
        {
          header: `${base} - City`,
          extract: (answers) => parseAddressAnswer(answers.get(field.id)).city.trim(),
        },
        {
          header: `${base} - State / Region`,
          extract: (answers) => parseAddressAnswer(answers.get(field.id)).region.trim(),
        },
        {
          header: `${base} - Postal Code`,
          extract: (answers) => parseAddressAnswer(answers.get(field.id)).postalCode.trim(),
        },
        {
          header: `${base} - Country`,
          extract: (answers) => parseAddressAnswer(answers.get(field.id)).country.trim(),
        }
      );
      continue;
    }

    if (field.fieldType === "TERMS") {
      columns.push({
        header: base,
        extract: (answers) => (isTermsAccepted(answers.get(field.id)) ? acceptedLabel : ""),
      });
      continue;
    }

    columns.push({
      header: base,
      extract: (answers) => answers.get(field.id) ?? "",
    });
  }

  return columns;
}

export type FieldValidationMessages = {
  questionnaireFieldRequired: string;
  questionnaireInvalidOption: string;
  invalidPhone: string;
  addressIncomplete: string;
  termsRequired: string;
};

export function validateQuestionnaireFieldsClient(
  fields: readonly {
    id: string;
    fieldType?: string | null;
    required?: boolean | null;
    options?: string | null;
  }[],
  answers: Record<string, string>,
  messages: FieldValidationMessages
): { fieldErrors: Record<string, string>; subFieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const subFieldErrors: Record<string, string> = {};

  for (const field of fields) {
    const res = validateRsvpFieldAnswer(field, answers[field.id]);
    if (res.valid) continue;
    fieldErrors[field.id] = messages[res.reason];
    if (
      field.fieldType === "ADDRESS" &&
      (res.reason === "questionnaireFieldRequired" || res.reason === "addressIncomplete")
    ) {
      const addr = parseAddressAnswer(answers[field.id]);
      if (!addr.line1.trim())
        subFieldErrors[`${field.id}:line1`] = messages.questionnaireFieldRequired;
      if (!addr.city.trim())
        subFieldErrors[`${field.id}:city`] = messages.questionnaireFieldRequired;
      if (!addr.postalCode.trim())
        subFieldErrors[`${field.id}:postalCode`] = messages.questionnaireFieldRequired;
    }
  }

  return { fieldErrors, subFieldErrors };
}
