// Contrast math for resolveTheme(). Pure functions, no imports, so lib/theme.ts
// can derive readable text from each event's own colors (built-in presets,
// admin-created presets and custom colors alike).
//
// Colors are CSS strings in the forms resolveTheme() emits: #rrggbb, rgb(),
// rgba(), hsl() and hsla() with comma-separated arguments.

export interface Rgba {
  r: number; // 0–255
  g: number;
  b: number;
  a: number; // 0–1
}

const COLOR_PATTERN = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|(?:rgba?|hsla?)\([^)]*\)/g;

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: 255 * f(0), g: 255 * f(8), b: 255 * f(4) };
}

function rgbToHsl({ r, g, b }: Rgba): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

/** Parses one CSS color string. Throws on a form resolveTheme() never emits. */
export function parseColor(css: string): Rgba {
  const c = css.trim();
  if (c.startsWith("#")) {
    const h = c.length === 4 ? [...c.slice(1)].map((x) => x + x).join("") : c.slice(1);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  const m = c.match(/^(rgba?|hsla?)\(([^)]*)\)$/);
  if (!m) throw new Error(`Unsupported color: ${css}`);
  const p = m[2].split(",").map((x) => parseFloat(x));
  if (m[1].startsWith("rgb")) return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  return { ...hslToRgb(p[0], p[1], p[2]), a: p[3] ?? 1 };
}

/** Every color in a CSS background value (gradient stops, or a single color). */
export function colorsIn(css: string): Rgba[] {
  return (css.match(COLOR_PATTERN) ?? []).map(parseColor);
}

/** `fg` painted over an opaque `bg`. */
export function composite(fg: Rgba, bg: Rgba): Rgba {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

/**
 * Evenly spaced samples along a two-color gradient, ends included. Luminance
 * can dip between the stops, so the middle is sampled too.
 */
export function sampleBetween(from: Rgba, to: Rgba, samples = 9): Rgba[] {
  return Array.from({ length: samples }, (_, i) => {
    const t = i / (samples - 1);
    return {
      r: from.r + (to.r - from.r) * t,
      g: from.g + (to.g - from.g) * t,
      b: from.b + (to.b - from.b) * t,
      a: 1,
    };
  });
}

function relativeLuminance({ r, g, b }: Rgba): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast of `fg` (composited if translucent) on an opaque `bg`. */
export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const top = fg.a < 1 ? composite(fg, bg) : fg;
  const x = relativeLuminance(top);
  const y = relativeLuminance(bg);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The lowest contrast `fg` reaches across every surface. */
export function minContrast(fg: string, surfaces: Rgba[]): number {
  const color = parseColor(fg);
  return Math.min(...surfaces.map((s) => contrastRatio(color, s)));
}

export function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const ch = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

/**
 * Returns `color` unchanged when it already reaches `ratio` on every surface.
 * Otherwise shifts its lightness (same hue and saturation) toward whichever of
 * black or white reads better on the surfaces until it does, and returns hex.
 * If no shade of that hue gets there, returns the better of black and white.
 */
export function ensureContrast(color: string, surfaces: Rgba[], ratio: number): string {
  if (minContrast(color, surfaces) >= ratio) return color;
  const { h, s, l } = rgbToHsl(parseColor(color));
  const lighten = minContrast("#ffffff", surfaces) > minContrast("#000000", surfaces);
  for (let step = 1; step <= 100; step++) {
    const next = lighten ? Math.min(100, l + step) : Math.max(0, l - step);
    const candidate = toHex(hslToRgb(h, s, next));
    if (minContrast(candidate, surfaces) >= ratio) return candidate;
  }
  return lighten ? "#ffffff" : "#000000";
}

/**
 * The smallest black wash (0–1, in steps of 0.01) that lets `fg` reach `ratio`
 * on every surface, or 1 when even a full wash isn't enough.
 */
export function scrimAlphaFor(fg: string, surfaces: Rgba[], ratio: number): number {
  for (let a = 0; a <= 100; a++) {
    const wash: Rgba = { r: 0, g: 0, b: 0, a: a / 100 };
    if (
      minContrast(
        fg,
        surfaces.map((s) => composite(wash, s))
      ) >= ratio
    )
      return a / 100;
  }
  return 1;
}
