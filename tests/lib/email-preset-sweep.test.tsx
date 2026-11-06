// Degradation-contract enforcement: every theme preset (current AND future —
// the loop reads THEME_PRESETS directly) must render every representative
// email template successfully, carry its accent color through, and stay well
// under Gmail's 102KB clipping threshold. It must also meet the email contrast
// contract on email surfaces (the white body, the details card, the canvas,
// the dark-mode surfaces, and the hero gradient plus its Outlook fallback).
import { describe, it, expect } from "vitest";
import { BASE_THEMES, THEME_PRESETS, resolveTheme } from "@/lib/theme";
import {
  bannerSurfaces,
  EMAIL_DARK_MODE,
  EMAIL_SURFACES,
  resolveEmailTheme,
  type EmailThemeInput,
} from "@/lib/email-theme";
import { colorsIn, minContrast, parseColor, type Rgba } from "@/lib/theme-contrast";
import { renderEmail } from "@/emails/render";
import { buildSampleEmail } from "@/emails/registry";

type SweepInput = EmailThemeInput & { name: string };

const inputs: SweepInput[] = [
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

// Custom colors hosts can pick: links and body inks must still pass, and the
// hero must use the best available ink.
const extremes: SweepInput[] = [
  {
    name: "custom:white-to-black",
    baseTheme: "BOLD",
    gradientFrom: "#ffffff",
    gradientTo: "#000000",
    accentColor: "#ffffff",
  },
  {
    name: "custom:yellow-to-violet",
    baseTheme: "BOLD",
    gradientFrom: "#facc15",
    gradientTo: "#7c3aed",
    accentColor: "#fde047",
  },
  {
    name: "custom:pale-soft",
    baseTheme: "SOFT",
    gradientFrom: "#fefce8",
    gradientTo: "#f0f9ff",
    accentColor: "#e0f2fe",
  },
  {
    name: "custom:black-accent-dark",
    baseTheme: "DARK",
    gradientFrom: "#000000",
    gradientTo: "#111111",
    accentColor: "#000000",
  },
];

// Mid-tone BOLD gradients where no ink reaches 4.5:1 for the small hero text
// (kicker, subtitle) across the whole gradient. Decision for #808: use the ink
// that reads best and leave the gradient unchanged. Ratios as measured.
const BEST_EFFORT_SMALL_HERO: Record<string, number> = {
  "preset:tropical-punch": 4.35,
  "preset:st-patricks": 4.19,
  "preset:blue-raspberry": 4.06,
};

const LIGHT = [EMAIL_SURFACES.body, EMAIL_SURFACES.card, EMAIL_SURFACES.canvas].map(parseColor);
const DARK = [EMAIL_DARK_MODE.canvas, EMAIL_DARK_MODE.body, EMAIL_DARK_MODE.card].map(parseColor);

/** The best any single ink (pure black or white) can do on these surfaces. */
const bestInk = (surfaces: Rgba[]) =>
  Math.max(minContrast("#000000", surfaces), minContrast("#ffffff", surfaces));

/**
 * `color:<hex>` as an inline text color: not background-color or border-color,
 * and not the dark-mode stylesheet (where the raw accent may be readable).
 */
const textColor = (hex: string) => new RegExp(`[;"]color:${hex}(?![0-9a-f])`, "i");

describe("email preset sweep", () => {
  it.each(inputs)(
    "renders invite + blast for $name with accent carried through and <100KB html",
    async ({ baseTheme, gradientFrom, gradientTo, accentColor }) => {
      const theme = resolveEmailTheme({ baseTheme, gradientFrom, gradientTo, accentColor });
      for (const id of ["invite", "blast"] as const) {
        const { element } = await buildSampleEmail(id, theme);
        const { html, text } = await renderEmail(element);
        expect(html.toLowerCase()).toContain(accentColor.toLowerCase());
        expect(Buffer.byteLength(html, "utf8")).toBeLessThan(100_000);
        expect(text.length).toBeGreaterThan(10);
      }
    }
  );
});

describe("email contrast contract", () => {
  it("keeps the fixed body and dark-mode inks readable on every surface they use", () => {
    const t = resolveEmailTheme(null);
    for (const ink of [t.textPrimary, t.textSecondary, t.textMuted]) {
      expect(minContrast(ink, LIGHT)).toBeGreaterThanOrEqual(4.5);
    }
    expect(minContrast(t.textMuted, LIGHT)).toBeLessThanOrEqual(
      minContrast(t.textSecondary, LIGHT)
    );
    for (const ink of [
      EMAIL_DARK_MODE.textPrimary,
      EMAIL_DARK_MODE.textSecondary,
      EMAIL_DARK_MODE.textMuted,
    ]) {
      expect(minContrast(ink, DARK)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([...inputs, ...extremes])("$name meets the email contrast contract", (input) => {
    const t = resolveEmailTheme(input);
    const isCustom = input.name.startsWith("custom:");

    // Links: the accent made readable, in light and dark mode. Fills keep it.
    expect(minContrast(t.linkColor, LIGHT)).toBeGreaterThanOrEqual(4.5);
    expect(minContrast(t.linkColorDark, DARK)).toBeGreaterThanOrEqual(4.5);
    // The underline (non-color cue) on the body and card; canvas links use linkColor.
    expect(minContrast(t.linkUnderline, LIGHT.slice(0, 2))).toBeGreaterThanOrEqual(3);
    expect(t.accent).toBe(input.accentColor);

    // Hero: every gradient stop, the samples between them, and the fallback.
    const hero = bannerSurfaces(t.heroGradient, t.heroFallback);
    const title = minContrast(t.heroText, hero);
    const small = minContrast(t.heroTextSecondary, hero);
    if (!isCustom) {
      expect(minContrast(t.heroText, colorsIn(t.heroGradient))).toBeGreaterThanOrEqual(3);
      expect(minContrast(t.heroText, [parseColor(t.heroFallback)])).toBeGreaterThanOrEqual(3);
      expect(title).toBeGreaterThanOrEqual(3);
      const floor = BEST_EFFORT_SMALL_HERO[input.name];
      expect(small).toBeGreaterThanOrEqual(floor === undefined ? 4.5 : floor - 0.01);
    }
    // Where no ink reaches the target, the one that reads best is used.
    expect(title).toBeGreaterThanOrEqual(Math.min(3, bestInk(hero)) - 0.01);
    expect(small).toBeGreaterThanOrEqual(Math.min(4.5, bestInk(hero)) - 0.01);

    // Host monogram: a graphic beside the name, 3:1 where an ink reaches it.
    const avatar = bannerSurfaces(t.avatarGradient, t.avatarFallback);
    expect(minContrast(t.avatarText, avatar)).toBeGreaterThanOrEqual(
      Math.min(3, bestInk(avatar)) - 0.01
    );
  });

  it("records only presets that really cannot reach 4.5:1 as best effort", () => {
    for (const name of Object.keys(BEST_EFFORT_SMALL_HERO)) {
      const input = inputs.find((i) => i.name === name)!;
      const t = resolveEmailTheme(input);
      expect(bestInk(bannerSurfaces(t.heroGradient, t.heroFallback))).toBeLessThan(4.5);
    }
  });

  it.each(inputs.filter((i) => i.baseTheme === "BOLD"))(
    "$name keeps the event page's hero ink where the bare gradient allows it",
    (input) => {
      const web = resolveTheme(
        input.baseTheme,
        input.gradientFrom,
        input.gradientTo,
        input.accentColor
      );
      // Without a scrim the web choice reads on the bare gradient, so email keeps it.
      if (!web.heroScrim) expect(resolveEmailTheme(input).heroText).toBe(web.heroText);
    }
  );

  it.each(inputs)(
    "$name renders accent-colored text in linkColor, never the raw accent",
    async (input) => {
      const t = resolveEmailTheme(input);
      for (const id of ["invite", "rsvpConfirmation", "blast"] as const) {
        const { element } = await buildSampleEmail(id, t);
        const { html } = await renderEmail(element);
        expect(html).toMatch(textColor(t.linkColor));
        if (t.linkColor.toLowerCase() !== t.accent.toLowerCase()) {
          expect(html).not.toMatch(textColor(t.accent));
        }
        expect(html).toMatch(new RegExp(`\\.dm-link\\s*\\{\\s*color:\\s*${t.linkColorDark}`, "i"));
        // Small hero text is a solid color, with no opacity over the gradient.
        expect(html).not.toMatch(/opacity:\s*0\.(85|9)\b/);
      }
    }
  );
});
