/**
 * Email theme resolver — derives an email-safe token set from the web theme.
 *
 * ── Degradation contract ─────────────────────────────────────────────────────
 * `resolveEmailTheme()` MUST derive everything from `resolveTheme()` in
 * `lib/theme.ts` — never maintain a parallel palette. That keeps emails in
 * lock-step with the event page: new presets (built-in or admin-created) and
 * changes to base-vibe logic propagate here with zero email-code changes.
 *
 * Email clients cannot render most modern CSS, so every `ResolvedTheme`
 * capability must either declare its email equivalent in the mapping below or
 * explicitly degrade:
 *   - gradients        → kept as `background-image`, with a solid `heroFallback`
 *                        `background-color` for Outlook/no-gradient clients
 *   - rgba/hsla tokens → converted to solid hex (Outlook cannot alpha-blend)
 *   - glass cards, blur, orbs/blobs, shadows, animations → dropped (static /
 *     solid equivalents); a future background-image capability should map to a
 *     bulletproof hero `background-image` with the same solid fallback
 *   - `heroScrim` (the web's dark wash behind white hero text) → dropped; email
 *     hero text is instead chosen against the gradient and its solid fallback
 *   - custom heading fonts (EventTheme.fontId) → the font's declared
 *     `emailStack` from lib/fonts.ts (web fonts don't load in email; the
 *     `var(--font-*)` value from resolveTheme() must never reach an email)
 *   - animated background effects (EventTheme.effectId/Density/Speed) →
 *     dropped entirely; effects are a web-only capability with no email
 *     equivalent
 *   - anything undeclared is IGNORED — email rendering must never break
 *     because a new web-theme token was added.
 *
 * ── Readable text ────────────────────────────────────────────────────────────
 * Email text is measured on email surfaces, never on web ones: the white body,
 * the details card and the canvas (light), the `EMAIL_DARK_MODE` surfaces, and
 * for the hero the gradient sampled stop to stop plus its solid fallback. The
 * contrast helpers come from lib/theme-contrast.ts. Colors move only in
 * lightness; fills, gradients and fonts are never changed.
 *   - `linkColor` / `linkColorDark`: the accent as link text, 4.5:1 on the
 *     light and dark-mode surfaces; `linkUnderline` keeps the accent itself
 *     where it reads 3:1. Accent fills keep `accent` + `accentFg`.
 *   - `heroText` (title, 3:1) and `heroTextSecondary` (kicker and subtitle,
 *     4.5:1): the web's hero choice first, then the other ink. When neither
 *     ink reaches both ratios across the whole gradient (a few mid-tone
 *     gradients), the ink that reads best is used as-is.
 *   - body inks: fixed grays that pass 4.5:1 on every light surface.
 * The preset-sweep test (tests/lib/email-preset-sweep.test.tsx) enforces this
 * for the whole preset color space.
 */

import {
  APP_SHELL,
  BASE_THEMES,
  type BaseTheme,
  getReadableText,
  HERO_INK,
  HERO_WHITE_SHADOW,
  hex2hsl,
  resolveTheme,
} from "./theme";
import {
  colorsIn,
  ensureContrast,
  minContrast,
  parseColor,
  sampleBetween,
  type Rgba,
} from "./theme-contrast";
import { getFontById } from "./fonts";

export type EmailThemeInput = {
  baseTheme: BaseTheme;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  coverImageUrl?: string | null;
  fontId?: string | null;
};

export interface EmailTheme {
  /** Which base vibe produced this theme (drives copy/typography choices). */
  base: BaseTheme;

  // Canvas — always light (decision: light canvas + themed accents; Gmail's
  // forced dark mode degrades light backgrounds gracefully).
  canvasBg: string;
  bodyBg: string;

  // Hero banner
  heroGradient: string; // CSS background-image value
  heroFallback: string; // solid hex background-color for Outlook
  heroText: string; // title: 3:1 on the gradient and the fallback
  heroTextSecondary: string; // kicker and subtitle: 4.5:1 where an ink can reach it
  heroTextShadow?: string;
  coverImageUrl?: string; // absolute URL, only when the event has one

  // Typography
  headingFont: string;
  bodyFont: string;
  headingWeight: string;
  headingTransform: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Accent
  accent: string; // fills, borders and rules only — never text on the body
  accentFg: string;
  linkColor: string; // accent-colored text: 4.5:1 on the body, card and canvas
  linkColorDark: string; // the same for the prefers-color-scheme: dark surfaces
  linkUnderline: string; // body/card links: the accent where it reads 3:1, else linkColor
  accentSoftBg: string; // solid hex tint of the accent (no rgba)
  accentBorder: string; // solid hex

  // Buttons
  btnRadius: string;
  btnFontWeight: string;
  btnTransform: string;

  // Cards (details card, quote blocks)
  cardBg: string;
  cardBorder: string;
  cardRadius: string;

  // Host monogram
  avatarGradient: string;
  avatarFallback: string; // solid hex for clients without gradient support
  avatarText: string;
}

const EMAIL_BODY_FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Light surfaces email text sits on: the body, the details card and the canvas (footer). */
export const EMAIL_SURFACES = {
  body: "#ffffff",
  card: "#f8f8fa",
  canvas: "#f4f4f7",
  border: "#e6e6ec",
} as const;

/**
 * The `prefers-color-scheme: dark` overrides EmailLayout ships (honored by
 * Apple Mail, Outlook and Samsung; Gmail applies its own inversion instead).
 */
export const EMAIL_DARK_MODE = {
  canvas: "#17171a",
  body: "#222226",
  card: "#2a2a30",
  border: "#3d3d46",
  textPrimary: "#f4f4f5",
  textSecondary: "#b3b3bc",
  textMuted: "#9a9aa3",
} as const;

const BODY_SURFACES = [EMAIL_SURFACES.body, EMAIL_SURFACES.card].map(parseColor);
const LIGHT_SURFACES = [...BODY_SURFACES, parseColor(EMAIL_SURFACES.canvas)];
const DARK_SURFACES = [EMAIL_DARK_MODE.canvas, EMAIL_DARK_MODE.body, EMAIL_DARK_MODE.card].map(
  parseColor
);

const AA_TEXT = 4.5;
const AA_LARGE = 3;
const WHITE = "#ffffff";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Solid hex from hue/saturation/lightness — email-safe stand-in for rgba tints. */
function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => {
    const c = lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Light solid tint of a color (email-safe replacement for rgba(color, ~0.15)). */
function solidTint(hex: string, lightness: number): string {
  const { h, s } = hex2hsl(hex);
  return hslToHex(h, Math.min(s, 70), lightness);
}

/** Make a stored (possibly relative) upload URL absolute for email clients. */
function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${APP_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Every color text can land on inside a banner: the gradient sampled between
 * each pair of stops (luminance can dip between them) plus the solid fallback
 * that no-gradient clients paint.
 */
export function bannerSurfaces(gradient: string, fallback: string): Rgba[] {
  const stops = colorsIn(gradient);
  const along = stops.slice(1).flatMap((to, i) => sampleBetween(stops[i], to));
  return [...(along.length ? along : stops), parseColor(fallback)];
}

interface BannerInk {
  text: string; // large text, 3:1
  secondary: string; // small text, 4.5:1 when this ink can reach it
  passes: boolean;
  small: number;
}

/**
 * Picks banner text: `preferred` (the web's choice) first, then the opposite
 * ink. A dark ink may deepen toward black in its own hue; white stays white.
 * When neither ink passes everywhere, returns the one whose small text reads
 * best: the gradient and its fallback are never altered.
 */
function bannerInk(preferred: string, surfaces: Rgba[], requireSmall = true): BannerInk {
  const darkInk = preferred.toLowerCase() === WHITE ? HERO_INK.text : preferred;
  const order = preferred.toLowerCase() === WHITE ? [WHITE, darkInk] : [darkInk, WHITE];
  const options = order.map((ink): BannerInk => {
    const toward = ink === WHITE ? "white" : "black";
    const text = ensureContrast(ink, surfaces, AA_LARGE, toward);
    const secondary = ensureContrast(ink, surfaces, AA_TEXT, toward);
    const small = minContrast(secondary, surfaces);
    const passes = minContrast(text, surfaces) >= AA_LARGE && (!requireSmall || small >= AA_TEXT);
    return { text, secondary, passes, small };
  });
  return options.find((o) => o.passes) ?? options.reduce((a, b) => (b.small > a.small ? b : a));
}

export function resolveEmailTheme(input?: EmailThemeInput | null): EmailTheme {
  const dark = BASE_THEMES.find((b) => b.id === "DARK")!;
  const base = input?.baseTheme ?? "DARK";
  const gradientFrom = input?.gradientFrom ?? dark.defaultGradientFrom;
  const gradientTo = input?.gradientTo ?? dark.defaultGradientTo;
  const accentColor = input?.accentColor ?? dark.defaultAccent;

  // Single source of truth: the web theme engine. fontId is deliberately NOT
  // passed — its web value is a var(--font-*) reference that email clients
  // cannot resolve; the email equivalent comes from the registry below.
  const t = resolveTheme(base, gradientFrom, gradientTo, accentColor);
  const customFont = getFontById(input?.fontId);

  const fromHsl = hex2hsl(gradientFrom);

  // Hero per base vibe (see mapping table in the module docblock):
  // DARK  → the moody clamped page gradient; SOFT → the raw pastel from→to
  // gradient; BOLD → the vivid full-bleed hero gradient.
  let heroGradient: string;
  let heroFallback: string;
  let preferredHeroText: string;
  if (base === "DARK") {
    heroGradient = t.pageBg;
    heroFallback = hslToHex(fromHsl.h, Math.min(fromHsl.s, 20), 9);
    preferredHeroText = t.textPrimary;
  } else if (base === "SOFT") {
    heroGradient = t.avatarGradient;
    heroFallback = gradientFrom;
    preferredHeroText = getReadableText(gradientFrom);
  } else {
    heroGradient = t.pageDecorationBg1;
    heroFallback = gradientFrom;
    preferredHeroText = t.heroText;
  }
  const hero = bannerInk(preferredHeroText, bannerSurfaces(heroGradient, heroFallback));
  const heroIsWhite = hero.text === WHITE;

  const linkColor = ensureContrast(t.accent, LIGHT_SURFACES, AA_TEXT);

  const avatarFallback = gradientFrom;
  // The monogram is a graphic beside the host's name: 3:1, like an icon.
  const avatar = bannerInk(
    getReadableText(gradientFrom),
    bannerSurfaces(t.avatarGradient, avatarFallback),
    false
  );

  return {
    base,
    canvasBg: EMAIL_SURFACES.canvas,
    bodyBg: EMAIL_SURFACES.body,
    heroGradient,
    heroFallback,
    heroText: hero.text,
    heroTextSecondary: hero.secondary,
    heroTextShadow:
      base === "BOLD" && heroIsWhite ? (t.heroTextShadow ?? HERO_WHITE_SHADOW) : undefined,
    coverImageUrl: input?.coverImageUrl ? absoluteUrl(input.coverImageUrl) : undefined,
    headingFont:
      customFont?.emailStack ?? (t.headingFont === "inherit" ? EMAIL_BODY_FONT : t.headingFont),
    bodyFont: EMAIL_BODY_FONT,
    headingWeight: base === "BOLD" ? "900" : "700",
    headingTransform: base === "BOLD" ? "uppercase" : "none",
    // Body copy sits on the light body, card and canvas — fixed inks that pass
    // 4.5:1 on all three (muted is never stronger than secondary).
    textPrimary: "#18181b",
    textSecondary: "#52525b",
    textMuted: "#6b6b75",
    accent: t.accent,
    accentFg: t.accentFg,
    linkColor,
    linkColorDark: ensureContrast(t.accent, DARK_SURFACES, AA_TEXT),
    // The underline is the link's non-color cue, so it needs 3:1 on the body
    // and card it sits on. A pale accent that can't give it (it reads in dark
    // mode instead) underlines in linkColor. Links on the canvas (footers) use
    // linkColor for both; see emails/components/linkStyle.ts.
    linkUnderline: minContrast(t.accent, BODY_SURFACES) >= AA_LARGE ? t.accent : linkColor,
    accentSoftBg: solidTint(accentColor, 94),
    accentBorder: solidTint(accentColor, 82),
    // SOFT gets full pills; DARK/BOLD carry the web button radius + weight.
    btnRadius: base === "SOFT" ? "999px" : t.btnRadius,
    btnFontWeight: t.btnFontWeight,
    btnTransform: t.btnTransform,
    cardBg: EMAIL_SURFACES.card,
    cardBorder: EMAIL_SURFACES.border,
    cardRadius: "12px",
    avatarGradient: t.avatarGradient,
    avatarFallback,
    avatarText: avatar.text,
  };
}

/** App-shell brand theme for non-event emails (magic link, welcome, test). */
export function appShellEmailTheme(): EmailTheme {
  const t = resolveEmailTheme({
    baseTheme: "DARK",
    gradientFrom: "#7c3aed",
    gradientTo: "#1e40af",
    accentColor: APP_SHELL.accent,
  });
  return { ...t, heroGradient: APP_SHELL.pageBg, heroFallback: "#13091f" };
}
