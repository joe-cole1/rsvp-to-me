import { describe, expect, it } from "vitest";
import {
  QUESTIONNAIRE_TEMPLATES,
  TERMS_ACCEPTED_VALUE,
  buildQuestionnaireCsvColumns,
  formatAddressDisplay,
  formatRsvpAnswerForDisplay,
  hasAnyAddressField,
  isAddressComplete,
  isFieldVisibleForRsvpStatus,
  isTermsAccepted,
  parseAddressAnswer,
  parseTermsFieldConfig,
  serializeAddressAnswer,
  serializeAddressDraft,
  serializeTermsFieldConfig,
  validateRsvpFieldAnswer,
} from "@/lib/rsvp-fields";

describe("rsvp-fields helpers (#786)", () => {
  it("exposes the 6 starter templates without song request and with emergency contact blurb", () => {
    const ids = QUESTIONNAIRE_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual([
      "address",
      "phone",
      "dietary",
      "emergencyContact",
      "accessibility",
      "terms",
    ]);
    const emergency = QUESTIONNAIRE_TEMPLATES.find((t) => t.id === "emergencyContact");
    expect(emergency?.hasDescription).toBe(true);
    expect(emergency?.goingOnly).toBe(true);
    const terms = QUESTIONNAIRE_TEMPLATES.find((t) => t.id === "terms");
    expect(terms?.fieldType).toBe("TERMS");
    expect(terms?.required).toBe(true);
  });

  it("parses, serializes, and validates international structured addresses", () => {
    const dutch = {
      line1: "Kerkstraat 12",
      line2: "",
      city: "Amsterdam",
      region: "",
      postalCode: "1017 GD",
      country: "",
    };
    expect(hasAnyAddressField(dutch)).toBe(true);
    expect(isAddressComplete(dutch)).toBe(true);
    const serialized = serializeAddressAnswer(dutch);
    expect(parseAddressAnswer(serialized)).toEqual(dutch);
    expect(formatAddressDisplay(serialized)).toBe("Kerkstraat 12, Amsterdam, 1017 GD");

    const withDraftSpaces = {
      ...dutch,
      line1: "Kerkstraat 12 ",
      country: "Netherlands",
    };
    expect(parseAddressAnswer(serializeAddressDraft(withDraftSpaces)).line1).toBe("Kerkstraat 12 ");
    expect(serializeAddressAnswer({ line1: "  ", city: "", postalCode: "" })).toBe("");
  });

  it("validates PHONE, ADDRESS, TERMS, and legacy field types", () => {
    expect(validateRsvpFieldAnswer({ fieldType: "PHONE", required: true }, "")).toEqual({
      valid: false,
      reason: "questionnaireFieldRequired",
    });
    expect(validateRsvpFieldAnswer({ fieldType: "PHONE", required: false }, "abc")).toEqual({
      valid: false,
      reason: "invalidPhone",
    });
    expect(
      validateRsvpFieldAnswer({ fieldType: "PHONE", required: true }, " +31 6 1234 5678 ")
    ).toEqual({
      valid: true,
      normalized: "+31 6 1234 5678",
    });

    // Optional address still rejects partial entry without city/postalCode
    expect(
      validateRsvpFieldAnswer(
        { fieldType: "ADDRESS", required: false },
        JSON.stringify({ line1: "123 Main St" })
      )
    ).toEqual({
      valid: false,
      reason: "addressIncomplete",
    });
    expect(
      validateRsvpFieldAnswer(
        { fieldType: "ADDRESS", required: false },
        JSON.stringify({ line1: "", city: "", postalCode: "" })
      )
    ).toEqual({ valid: true, normalized: null });

    expect(
      validateRsvpFieldAnswer(
        { fieldType: "ADDRESS", required: true },
        JSON.stringify({ line1: " 123 Main St ", city: " Boston ", postalCode: " 02101 " })
      )
    ).toEqual({
      valid: true,
      normalized: JSON.stringify({ line1: "123 Main St", city: "Boston", postalCode: "02101" }),
    });

    expect(validateRsvpFieldAnswer({ fieldType: "TERMS", required: true }, "")).toEqual({
      valid: false,
      reason: "termsRequired",
    });
    expect(
      validateRsvpFieldAnswer({ fieldType: "TERMS", required: true }, TERMS_ACCEPTED_VALUE)
    ).toEqual({
      valid: true,
      normalized: TERMS_ACCEPTED_VALUE,
    });
  });

  it("handles terms config serialization and formatting", () => {
    const serialized = serializeTermsFieldConfig({
      text: "  Be respectful.  ",
      url: " https://example.com/terms ",
    });
    expect(parseTermsFieldConfig(serialized)).toEqual({
      text: "Be respectful.",
      url: "https://example.com/terms",
    });
    expect(serializeTermsFieldConfig({ text: " ", url: "" })).toBeNull();
    expect(isTermsAccepted(TERMS_ACCEPTED_VALUE)).toBe(true);
    expect(isTermsAccepted("no")).toBe(false);
    expect(
      formatRsvpAnswerForDisplay("TERMS", TERMS_ACCEPTED_VALUE, { acceptedLabel: "Agreed" })
    ).toBe("Agreed");
  });

  it("filters visibility by RSVP status and builds expanded CSV columns", () => {
    expect(isFieldVisibleForRsvpStatus({ goingOnly: true }, "GOING")).toBe(true);
    expect(isFieldVisibleForRsvpStatus({ goingOnly: true }, "MAYBE")).toBe(false);
    expect(isFieldVisibleForRsvpStatus({ goingOnly: false }, "MAYBE")).toBe(true);
    expect(isFieldVisibleForRsvpStatus({ goingOnly: false }, "NO")).toBe(false);

    const cols = buildQuestionnaireCsvColumns([
      { id: "addr", label: "Mailing address", fieldType: "ADDRESS" },
      { id: "terms", label: "Waiver", fieldType: "TERMS" },
      { id: "phone", label: "Phone", fieldType: "PHONE" },
    ]);
    expect(cols.map((c) => c.header)).toEqual([
      "Mailing address - Street",
      "Mailing address - Line 2",
      "Mailing address - City",
      "Mailing address - State / Region",
      "Mailing address - Postal Code",
      "Mailing address - Country",
      "Waiver",
      "Phone",
    ]);

    const answers = new Map<string, string>([
      [
        "addr",
        JSON.stringify({
          line1: "10 Downing St",
          city: "London",
          postalCode: "SW1A 2AA",
          country: "UK",
        }),
      ],
      ["terms", TERMS_ACCEPTED_VALUE],
      ["phone", "+44 20 7946 0958"],
    ]);
    expect(cols.map((c) => c.extract(answers))).toEqual([
      "10 Downing St",
      "",
      "London",
      "",
      "SW1A 2AA",
      "UK",
      "Agreed",
      "+44 20 7946 0958",
    ]);
  });
});
