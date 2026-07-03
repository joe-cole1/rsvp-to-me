// Degradation-contract enforcement: every theme preset (current AND future —
// the loop reads THEME_PRESETS directly) must render every representative
// email template successfully, carry its accent color through, and stay well
// under Gmail's 102KB clipping threshold.
import { describe, it, expect } from "vitest";
import { BASE_THEMES, THEME_PRESETS } from "@/lib/theme";
import { resolveEmailTheme } from "@/lib/email-theme";
import { renderEmail } from "@/emails/render";
import { buildSampleEmail } from "@/emails/registry";

const inputs = [
  ...BASE_THEMES.map((b) => ({
    name: `base:${b.id}`,
    baseTheme: b.id,
    gradientFrom: b.defaultGradientFrom,
    gradientTo: b.defaultGradientTo,
    accentColor: b.defaultAccent,
  })),
  ...THEME_PRESETS.map((p) => ({
    name: `preset:${p.id}`,
    baseTheme: p.base,
    gradientFrom: p.gradientFrom,
    gradientTo: p.gradientTo,
    accentColor: p.accentColor,
  })),
];

describe("email preset sweep", () => {
  it.each(inputs)(
    "renders invite + blast for $name with accent carried through and <100KB html",
    async ({ baseTheme, gradientFrom, gradientTo, accentColor }) => {
      const theme = resolveEmailTheme({ baseTheme, gradientFrom, gradientTo, accentColor });
      for (const id of ["invite", "blast"] as const) {
        const { element } = buildSampleEmail(id, theme);
        const { html, text } = await renderEmail(element);
        expect(html.toLowerCase()).toContain(accentColor.toLowerCase());
        expect(Buffer.byteLength(html, "utf8")).toBeLessThan(100_000);
        expect(text.length).toBeGreaterThan(10);
      }
    }
  );
});
