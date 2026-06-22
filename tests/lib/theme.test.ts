import { describe, it, expect } from "vitest";
import { resolveTheme, getReadableText, THEME_PRESETS } from "@/lib/theme";

describe("Theme Resolution", () => {
  describe("getReadableText", () => {
    it("returns #ffffff for dark background colors", () => {
      expect(getReadableText("#000000")).toBe("#ffffff");
      expect(getReadableText("#121212")).toBe("#ffffff");
      expect(getReadableText("#581c87")).toBe("#ffffff"); // dark purple
    });

    it("returns #0a0a0a for light background colors", () => {
      expect(getReadableText("#ffffff")).toBe("#0a0a0a");
      expect(getReadableText("#fef08a")).toBe("#0a0a0a"); // light yellow
      expect(getReadableText("#a7f3d0")).toBe("#0a0a0a"); // light emerald
    });
  });

  describe("resolveTheme", () => {
    it("handles dark, soft, and bold base themes correctly", () => {
      const darkTheme = resolveTheme("DARK", "#7c3aed", "#1e40af", "#581c87");
      expect(darkTheme.pageDecoration).toBe("dark-orbs");
      expect(darkTheme.accentFg).toBe("#ffffff"); // dark purple → white text

      const softTheme = resolveTheme("SOFT", "#fda4af", "#ddd6fe", "#e11d48");
      expect(softTheme.pageDecoration).toBe("soft-blobs");

      const boldTheme = resolveTheme("BOLD", "#f97316", "#ec4899", "#f97316");
      expect(boldTheme.pageDecoration).toBe("bold-hero");
    });

    it("passes gradientFrom and gradientTo through to avatarGradient", () => {
      const theme = resolveTheme("DARK", "#ef4444", "#3b82f6", "#ef4444");
      expect(theme.gradientFrom).toBe("#ef4444");
      expect(theme.gradientTo).toBe("#3b82f6");
      expect(theme.avatarGradient).toContain("#ef4444");
      expect(theme.avatarGradient).toContain("#3b82f6");
    });

    it("uses accentColor independently from gradient colors", () => {
      // 4th of July: red+blue gradient, red accent button
      const theme = resolveTheme("BOLD", "#dc2626", "#1d4ed8", "#dc2626");
      expect(theme.accent).toBe("#dc2626");
      // bold hero strip uses both gradient colors
      expect(theme.pageDecorationBg1).toContain("#dc2626");
      expect(theme.pageDecorationBg1).toContain("#1d4ed8");
    });

    it("computes WCAG-readable accentFg for light accent colors", () => {
      const theme = resolveTheme("DARK", "#7c3aed", "#1e40af", "#fef08a"); // yellow accent button
      expect(theme.accentFg).toBe("#0a0a0a"); // dark text on light yellow
    });
  });

  describe("THEME_PRESETS", () => {
    it("includes seasonal presets", () => {
      const seasonal = THEME_PRESETS.filter((p) => p.seasonal);
      expect(seasonal.length).toBeGreaterThan(0);
    });

    it("fourth-of-july preset has distinct red and blue gradient colors", () => {
      const july4th = THEME_PRESETS.find((p) => p.id === "fourth-of-july");
      expect(july4th).toBeDefined();
      expect(july4th!.gradientFrom).not.toBe(july4th!.gradientTo);
    });

    it("all presets have required fields", () => {
      for (const preset of THEME_PRESETS) {
        expect(preset).toHaveProperty("id");
        expect(preset).toHaveProperty("gradientFrom");
        expect(preset).toHaveProperty("gradientTo");
        expect(preset).toHaveProperty("accentColor");
        expect(preset).toHaveProperty("base");
      }
    });
  });
});
