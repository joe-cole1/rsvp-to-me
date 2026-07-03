import { describe, it, expect } from "vitest";
import { resolveEmailTheme, appShellEmailTheme, type EmailThemeInput } from "@/lib/email-theme";
import { getReadableText, resolveTheme } from "@/lib/theme";

const soft: EmailThemeInput = {
  baseTheme: "SOFT",
  gradientFrom: "#fda4af",
  gradientTo: "#ddd6fe",
  accentColor: "#ec4899",
};
const dark: EmailThemeInput = {
  baseTheme: "DARK",
  gradientFrom: "#7c3aed",
  gradientTo: "#1e40af",
  accentColor: "#a855f7",
};
const bold: EmailThemeInput = {
  baseTheme: "BOLD",
  gradientFrom: "#f97316",
  gradientTo: "#ec4899",
  accentColor: "#f97316",
};

describe("lib/email-theme.ts", () => {
  it("derives the DARK hero from resolveTheme().pageBg", () => {
    const t = resolveEmailTheme(dark);
    const web = resolveTheme("DARK", dark.gradientFrom, dark.gradientTo, dark.accentColor);
    expect(t.heroGradient).toBe(web.pageBg);
    expect(t.heroText).toBe("#ffffff");
  });

  it("derives the SOFT hero from the raw pastel gradient with serif + pill buttons", () => {
    const t = resolveEmailTheme(soft);
    const web = resolveTheme("SOFT", soft.gradientFrom, soft.gradientTo, soft.accentColor);
    expect(t.heroGradient).toBe(web.avatarGradient);
    expect(t.headingFont).toContain("Georgia");
    expect(t.btnRadius).toBe("999px");
  });

  it("derives the BOLD hero from resolveTheme().pageDecorationBg1 with heavy uppercase type", () => {
    const t = resolveEmailTheme(bold);
    const web = resolveTheme("BOLD", bold.gradientFrom, bold.gradientTo, bold.accentColor);
    expect(t.heroGradient).toBe(web.pageDecorationBg1);
    expect(t.headingWeight).toBe("900");
    expect(t.headingTransform).toBe("uppercase");
    expect(t.btnFontWeight).toBe("900");
    expect(t.btnTransform).toBe("uppercase");
  });

  it("computes accentFg via the shared WCAG helper", () => {
    for (const input of [dark, soft, bold]) {
      expect(resolveEmailTheme(input).accentFg).toBe(getReadableText(input.accentColor));
    }
  });

  it("emits only solid colors for Outlook-critical tokens (no rgba/hsla)", () => {
    for (const input of [dark, soft, bold]) {
      const t = resolveEmailTheme(input);
      for (const token of [
        t.heroFallback,
        t.accent,
        t.accentFg,
        t.accentSoftBg,
        t.accentBorder,
        t.cardBg,
        t.cardBorder,
        t.bodyBg,
        t.canvasBg,
        t.avatarFallback,
      ]) {
        expect(token).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("keeps the canvas light regardless of base theme", () => {
    for (const input of [dark, soft, bold]) {
      const t = resolveEmailTheme(input);
      expect(t.bodyBg).toBe("#ffffff");
      expect(getReadableText(t.canvasBg)).toBe("#0a0a0a");
    }
  });

  it("falls back to DARK defaults when the event has no theme", () => {
    const t = resolveEmailTheme(null);
    expect(t.base).toBe("DARK");
    expect(t.accent).toBe("#a855f7");
    expect(t.heroGradient).toContain("linear-gradient");
  });

  it("makes relative cover image URLs absolute and passes through absolute ones", () => {
    const rel = resolveEmailTheme({ ...dark, coverImageUrl: "/api/uploads/abc.jpg" });
    expect(rel.coverImageUrl).toBe("http://localhost:3000/api/uploads/abc.jpg");
    const abs = resolveEmailTheme({ ...dark, coverImageUrl: "https://cdn.example.com/x.png" });
    expect(abs.coverImageUrl).toBe("https://cdn.example.com/x.png");
    expect(resolveEmailTheme(dark).coverImageUrl).toBeUndefined();
  });

  it("appShellEmailTheme uses the brand accent on the app-shell gradient", () => {
    const t = appShellEmailTheme();
    expect(t.accent).toBe("#a855f7");
    expect(t.heroGradient).toContain("#13091f");
    expect(t.heroFallback).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
