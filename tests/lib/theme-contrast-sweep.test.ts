// Contrast-contract enforcement for the web theme engine: every base default,
// every built-in preset (current AND future — the loop reads THEME_PRESETS
// directly) and a few extreme custom colors must produce readable text at the
// theme's default card opacity and at the lowest opacity hosts can choose.
// See "Contrast contract" in docs/engineering/design-language.md.
//
// The color math below is deliberately independent of lib/theme-contrast.ts so
// the engine is not checked against itself.
import { describe, it, expect } from "vitest";
import {
  BASE_THEMES,
  THEME_PRESETS,
  MIN_CARD_OPACITY,
  getDefaultCardOpacity,
  resolveTheme,
  type BaseTheme,
  type ResolvedTheme,
} from "@/lib/theme";

type Color = { r: number; g: number; b: number; a: number };

function hsl(h: number, s: number, l: number): Omit<Color, "a"> {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = light - c / 2;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

function color(css: string): Color {
  const s = css.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) {
    const n = parseInt(s.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const m = s.match(/^(rgb|rgba|hsl|hsla)\((.*)\)$/);
  if (!m) throw new Error(`unparsed color ${css}`);
  const [p0, p1, p2, p3] = m[2].split(",").map((v) => parseFloat(v));
  const alpha = Number.isNaN(p3) || p3 === undefined ? 1 : p3;
  return m[1].startsWith("rgb")
    ? { r: p0, g: p1, b: p2, a: alpha }
    : { ...hsl(p0, p1, p2), a: alpha };
}

const colorsOf = (css: string) =>
  (css.match(/#[0-9a-f]{6}|(?:rgba?|hsla?)\([^)]*\)/gi) ?? []).map(color);

const over = (top: Color, under: Color): Color => ({
  r: top.r * top.a + under.r * (1 - top.a),
  g: top.g * top.a + under.g * (1 - top.a),
  b: top.b * top.a + under.b * (1 - top.a),
  a: 1,
});

function luminance(c: Color): number {
  const ch = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

function ratio(fg: string, bg: Color): number {
  const a = luminance(over(color(fg), bg));
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const worst = (fg: string, surfaces: Color[]) => Math.min(...surfaces.map((s) => ratio(fg, s)));

/** Where text can land outside a card: the page ground, sampled densely. */
function grounds(t: ResolvedTheme): Color[] {
  if (t.pageDecoration === "bold-hero") {
    const [from, to] = colorsOf(t.pageDecorationBg1);
    return Array.from({ length: 21 }, (_, i) => {
      const k = i / 20;
      return {
        r: from.r + (to.r - from.r) * k,
        g: from.g + (to.g - from.g) * k,
        b: from.b + (to.b - from.b) * k,
        a: 1,
      };
    });
  }
  const [glowA] = colorsOf(t.pageDecorationBg1);
  const [glowB] = colorsOf(t.pageDecorationBg2);
  return colorsOf(t.pageBg).flatMap((stop) => [
    stop,
    over(glowA, stop),
    over(glowB, stop),
    over(glowA, over(glowB, stop)),
  ]);
}

const inputs: {
  name: string;
  base: BaseTheme;
  from: string;
  to: string;
  accent: string;
}[] = [
  ...BASE_THEMES.map((b) => ({
    name: `base:${b.id}`,
    base: b.id,
    from: b.defaultGradientFrom,
    to: b.defaultGradientTo,
    accent: b.defaultAccent,
  })),
  ...THEME_PRESETS.map((p) => ({
    name: `preset:${p.id}`,
    base: p.base,
    from: p.gradientFrom,
    to: p.gradientTo,
    accent: p.accentColor,
  })),
  // Admin-created presets and custom colors can be anything.
  { name: "custom:bold-night", base: "BOLD", from: "#000000", to: "#1e3a8a", accent: "#fde047" },
  { name: "custom:bold-pale", base: "BOLD", from: "#ffffff", to: "#fef9c3", accent: "#fef08a" },
  { name: "custom:soft-neon", base: "SOFT", from: "#ffffff", to: "#ffffff", accent: "#ffff00" },
  { name: "custom:dark-ink", base: "DARK", from: "#ffffff", to: "#f0f0f0", accent: "#000080" },
];

const cases = inputs.flatMap((input) =>
  [getDefaultCardOpacity(input.base), MIN_CARD_OPACITY].map((opacity) => ({
    ...input,
    opacity,
  }))
);

describe("theme contrast sweep", () => {
  it.each(cases)("$name at card opacity $opacity reads at AA", (c) => {
    const t = resolveTheme(c.base, c.from, c.to, c.accent, c.opacity);
    const ground = grounds(t);
    const cards = ground.map((g) => over(color(t.cardBg), g));
    const on = (layer: string) => cards.map((card) => over(color(layer), card));

    expect(worst(t.textPrimary, cards), "textPrimary").toBeGreaterThanOrEqual(4.5);
    expect(worst(t.textSecondary, cards), "textSecondary").toBeGreaterThanOrEqual(4.5);
    expect(worst(t.textMuted, cards), "textMuted").toBeGreaterThanOrEqual(4.5);
    expect(
      worst(t.textMuted, cards),
      "textMuted must not read stronger than textSecondary"
    ).toBeLessThanOrEqual(worst(t.textSecondary, cards) + 1e-9);
    expect(worst(t.inputPlaceholder, on(t.inputBg)), "inputPlaceholder").toBeGreaterThanOrEqual(
      4.5
    );
    expect(worst(t.accentText, cards), "accentText on card").toBeGreaterThanOrEqual(4.5);
    expect(worst(t.accentText, on(t.accentBg)), "accentText on accentBg").toBeGreaterThanOrEqual(
      4.5
    );
    expect(worst(t.badgeText, on(t.badgeBg)), "badgeText").toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.accentFg, color(t.accent)), "accentFg on accent").toBeGreaterThanOrEqual(4.5);
    for (const [kind, s] of Object.entries(t.status)) {
      expect(worst(s.text, on(s.bg)), `status.${kind}`).toBeGreaterThanOrEqual(4.5);
    }

    const heroGround = t.heroScrim ? ground.map((g) => over(color(t.heroScrim!), g)) : ground;
    expect(worst(t.heroText, heroGround), "heroText").toBeGreaterThanOrEqual(3);
    expect(worst(t.heroTextSecondary, heroGround), "heroTextSecondary").toBeGreaterThanOrEqual(4.5);
    expect(worst(t.heroTextMuted, heroGround), "heroTextMuted").toBeGreaterThanOrEqual(3);
  });
});
