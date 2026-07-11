import { describe, it, expect } from "vitest";
import {
  FONT_OPTIONS,
  FONT_CATEGORY_LABELS,
  getFontById,
  getHeadingFontValue,
  isValidFontId,
} from "@/lib/fonts";

describe("font registry", () => {
  it("has unique ids and css variables", () => {
    const ids = FONT_OPTIONS.map((f) => f.id);
    const vars = FONT_OPTIONS.map((f) => f.cssVar);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(vars).size).toBe(vars.length);
  });

  it("every font declares an email-safe stack and a web fallback", () => {
    for (const f of FONT_OPTIONS) {
      // Degradation contract: email must never see a var(--font-*) value
      expect(f.emailStack.length).toBeGreaterThan(0);
      expect(f.emailStack).not.toContain("var(");
      expect(f.fallback.length).toBeGreaterThan(0);
      expect(f.cssVar).toMatch(/^--font-[a-z-]+$/);
      expect(FONT_CATEGORY_LABELS[f.category]).toBeTruthy();
    }
  });

  it("getFontById resolves known ids and rejects unknown ones", () => {
    expect(getFontById("playfair")?.label).toBe("Playfair Display");
    expect(getFontById("comic-sans")).toBeNull();
    expect(getFontById(null)).toBeNull();
    expect(getFontById(undefined)).toBeNull();
  });

  it("isValidFontId treats null/undefined as valid (theme default) and unknown ids as invalid", () => {
    expect(isValidFontId(null)).toBe(true);
    expect(isValidFontId(undefined)).toBe(true);
    expect(isValidFontId("roboto")).toBe(true);
    expect(isValidFontId("papyrus")).toBe(false);
  });

  it("getHeadingFontValue returns a var() reference with fallback, or null for unset", () => {
    const v = getHeadingFontValue("bebas");
    expect(v).toContain("var(--font-bebas)");
    expect(v).toContain("Impact");
    expect(getHeadingFontValue(null)).toBeNull();
    expect(getHeadingFontValue("nope")).toBeNull();
  });
});
