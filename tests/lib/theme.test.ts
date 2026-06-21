import { describe, it, expect } from "vitest";
import { resolveTheme, getSortedPresets, getReadableText } from "@/lib/theme";

describe("Theme Resolution & Presets Sorting", () => {
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
      const darkTheme = resolveTheme("DARK", "#a855f7");
      expect(darkTheme.pageDecoration).toBe("dark-orbs");
      expect(darkTheme.accentFg).toBe("#ffffff");

      const softTheme = resolveTheme("SOFT", "#22c55e");
      expect(softTheme.pageDecoration).toBe("soft-blobs");

      const boldTheme = resolveTheme("BOLD", "#f97316");
      expect(boldTheme.pageDecoration).toBe("bold-hero");
    });

    it("derives secondary color when not provided", () => {
      const darkTheme = resolveTheme("DARK", "#a855f7", null);
      expect(darkTheme.secondaryAccent).toBeDefined();
      expect(darkTheme.secondaryAccent).not.toBe("#a855f7");
    });

    it("blends primary and secondary accent in gradients", () => {
      const darkTheme = resolveTheme("DARK", "#ef4444", "#3b82f6");
      expect(darkTheme.avatarGradient).toContain("#ef4444");
      expect(darkTheme.avatarGradient).toContain("#3b82f6");
    });
  });

  describe("getSortedPresets", () => {
    it("always keeps 'custom' first", () => {
      const sorted = getSortedPresets(new Date("2026-06-21"));
      expect(sorted[0].id).toBe("custom");
    });

    it("sorts seasonal presets relative to June (current month)", () => {
      // June is month 6
      const sorted = getSortedPresets(new Date("2026-06-21"));
      
      // The first few presets should be summer and fourth of July since they are month 6 and 7
      const ids = sorted.slice(1, 4).map(p => p.id);
      expect(ids).toContain("summer"); // June (month 6)
      expect(ids).toContain("july4th"); // July (month 7)
    });

    it("sorts seasonal presets relative to December (current month)", () => {
      // December is month 12
      const sorted = getSortedPresets(new Date("2026-12-25"));
      
      // Winter, Christmas, and New Year's Eve should be sorted first (month 12)
      const ids = sorted.slice(1, 5).map(p => p.id);
      expect(ids).toContain("christmas");
      expect(ids).toContain("winter");
      expect(ids).toContain("newyears");
    });
  });
});
