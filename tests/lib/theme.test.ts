import { describe, it, expect } from "vitest";
import { resolveTheme, getReadableText, THEME_PRESETS, getSortedPresets } from "@/lib/theme";

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

  describe("getSortedPresets", () => {
    const seasonal = (id: string, name: string, month: number) => ({
      id,
      name,
      seasonal: true,
      month,
    });
    const general = (id: string, name: string) => ({ id, name, seasonal: false });

    it("seasonal presets float before non-seasonal", () => {
      const presets = [general("g1", "Zebra"), seasonal("s1", "Alpha", 6)];
      const result = getSortedPresets(presets, new Date("2026-01-01"));
      expect(result[0].id).toBe("s1");
      expect(result[1].id).toBe("g1");
    });

    it("sorts seasonal presets by month proximity to current month", () => {
      const oct = new Date("2026-10-01");
      const presets = [
        seasonal("thanksgiving", "Thanksgiving", 11),
        seasonal("halloween", "Halloween", 10),
        seasonal("valentines", "Valentine's Day", 2),
      ];
      const result = getSortedPresets(presets, oct);
      expect(result[0].id).toBe("halloween"); // distance 0
      expect(result[1].id).toBe("thanksgiving"); // distance 1
      expect(result[2].id).toBe("valentines"); // distance 4
    });

    it("wrap-around: November → December before February", () => {
      const nov = new Date("2026-11-01");
      const presets = [
        seasonal("valentines", "Valentine's Day", 2),
        seasonal("winter-holidays", "Winter Holidays", 12),
      ];
      const result = getSortedPresets(presets, nov);
      expect(result[0].id).toBe("winter-holidays"); // 1 month away
      expect(result[1].id).toBe("valentines"); // 3 months away
    });

    it("ties broken by name alphabetically", () => {
      const jan = new Date("2026-01-01");
      const presets = [
        seasonal("easter", "Easter", 3),
        seasonal("spring", "Spring", 3),
        seasonal("st-patricks", "St. Patrick's Day", 3),
      ];
      const result = getSortedPresets(presets, jan);
      expect(result.map((p) => p.id)).toEqual(["easter", "spring", "st-patricks"]);
    });

    it("non-seasonal presets sorted alphabetically among themselves", () => {
      const presets = [general("z", "Zebra"), general("a", "Apple"), general("m", "Mango")];
      const result = getSortedPresets(presets);
      expect(result.map((p) => p.name)).toEqual(["Apple", "Mango", "Zebra"]);
    });

    it("seasonal presets without a month sort with non-seasonal alphabetically", () => {
      const presets = [
        { id: "s-no-month", name: "Autumn Fest", seasonal: true, month: undefined },
        general("g1", "Zebra"),
        seasonal("s1", "Alpha", 6),
      ];
      const result = getSortedPresets(presets, new Date("2026-01-01"));
      expect(result[0].id).toBe("s1");
      // "Autumn Fest" and "Zebra" are non-month-seasonal and general — both treated as non-month
      expect(result[1].name).toBe("Autumn Fest");
      expect(result[2].name).toBe("Zebra");
    });

    it("does not mutate the original array", () => {
      const presets = [seasonal("s1", "B", 6), seasonal("s2", "A", 6)];
      const original = [...presets];
      getSortedPresets(presets);
      expect(presets).toEqual(original);
    });
  });
});
