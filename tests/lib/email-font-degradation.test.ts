// Degradation contract: custom heading fonts (EventTheme.fontId) must reach
// emails as the registry's email-safe stack — never as a var(--font-*)
// reference, which no email client can resolve. Effects must not leak into
// the email theme at all.
import { describe, it, expect } from "vitest";
import { resolveEmailTheme } from "@/lib/email-theme";
import { FONT_OPTIONS } from "@/lib/fonts";

const BASE_INPUT = {
  baseTheme: "DARK" as const,
  gradientFrom: "#7c3aed",
  gradientTo: "#1e40af",
  accentColor: "#a855f7",
};

describe("email font degradation", () => {
  it("maps every registry font to its email stack", () => {
    for (const f of FONT_OPTIONS) {
      const t = resolveEmailTheme({ ...BASE_INPUT, fontId: f.id });
      expect(t.headingFont).toBe(f.emailStack);
      expect(t.headingFont).not.toContain("var(");
    }
  });

  it("falls back to base-theme behavior when fontId is unset or unknown", () => {
    const noFont = resolveEmailTheme(BASE_INPUT);
    const unknownFont = resolveEmailTheme({ ...BASE_INPUT, fontId: "not-a-font" });
    expect(unknownFont.headingFont).toBe(noFont.headingFont);
    expect(noFont.headingFont).not.toContain("var(");

    // SOFT keeps its serif default when no custom font is chosen
    const soft = resolveEmailTheme({ ...BASE_INPUT, baseTheme: "SOFT" });
    expect(soft.headingFont).toContain("Georgia");
  });

  it("ignores effect fields entirely (web-only capability)", () => {
    const withEffect = resolveEmailTheme({
      ...BASE_INPUT,
      // Extra fields simulate passing a full EventTheme row through
      effectId: "thanksgiving",
      effectDensity: "dense",
      effectSpeed: "lively",
    } as Parameters<typeof resolveEmailTheme>[0] & Record<string, unknown>);
    const without = resolveEmailTheme(BASE_INPUT);
    expect(withEffect).toEqual(without);
  });
});
