import { describe, it, expect } from "vitest";
import {
  appShellEmailTheme,
  bannerSurfaces,
  resolveEmailTheme,
  type EmailThemeInput,
} from "@/lib/email-theme";
import { minContrast } from "@/lib/theme-contrast";
import { getReadableText, hex2hsl, HERO_INK, HERO_WHITE_SHADOW, resolveTheme } from "@/lib/theme";

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

  it("uses the dark stone ink on a BOLD gradient where white only works with the web scrim", () => {
    // Sunset: white reads 2.8:1 on the bare gradient; email has no scrim.
    const web = resolveTheme("BOLD", bold.gradientFrom, bold.gradientTo, bold.accentColor);
    expect(web.heroScrim).toBeDefined();
    const t = resolveEmailTheme(bold);
    expect(t.heroText).toBe(HERO_INK.text);
    expect(t.heroTextSecondary).toBe(HERO_INK.text);
    expect(t.heroTextShadow).toBeUndefined();
  });

  it("keeps white BOLD hero text, with the web shadow, where it reads on the bare gradient", () => {
    const grape = { ...bold, gradientFrom: "#7c3aed", gradientTo: "#c026d3" };
    const t = resolveEmailTheme(grape);
    expect(t.heroText).toBe("#ffffff");
    expect(t.heroTextShadow).toBe(HERO_WHITE_SHADOW);
  });

  it("derives linkColor from the accent in lightness only, and leaves readable accents alone", () => {
    const winter = resolveEmailTheme({ ...dark, accentColor: "#bae6fd" });
    expect(winter.accent).toBe("#bae6fd");
    expect(winter.linkColor).not.toBe("#bae6fd");
    expect(hex2hsl(winter.linkColor).h).toBeCloseTo(hex2hsl("#bae6fd").h, -1);
    expect(winter.linkColorDark).toBe("#bae6fd");
    const grape = resolveEmailTheme({ ...bold, accentColor: "#a21caf" });
    expect(grape.linkColor).toBe("#a21caf");
  });

  it("underlines links in the accent where it reads 3:1 on the body and card, else in linkColor", () => {
    const pale = resolveEmailTheme({ ...dark, accentColor: "#bae6fd" }); // Winter, 1.3:1
    expect(pale.linkUnderline).toBe(pale.linkColor);
    const amber = resolveEmailTheme({ ...bold, accentColor: "#d97706" }); // Summer, 3.0:1
    expect(amber.linkUnderline).toBe("#d97706");
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
        t.heroText,
        t.heroTextSecondary,
        t.accent,
        t.accentFg,
        t.linkColor,
        t.linkColorDark,
        t.linkUnderline,
        t.textMuted,
        t.avatarText,
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
    // The app-shell hero swaps in its own gradient; white still reads there.
    expect(minContrast(t.heroText, bannerSurfaces(t.heroGradient, t.heroFallback))).toBeGreaterThan(
      4.5
    );
  });
});
