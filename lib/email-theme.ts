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
 *   - custom heading fonts (EventTheme.fontId) → the font's declared
 *     `emailStack` from lib/fonts.ts (web fonts don't load in email; the
 *     `var(--font-*)` value from resolveTheme() must never reach an email)
 *   - animated background effects (EventTheme.effectId/Density/Speed) →
 *     dropped entirely; effects are a web-only capability with no email
 *     equivalent
 *   - anything undeclared is IGNORED — email rendering must never break
 *     because a new web-theme token was added.
 * The preset-sweep test (tests/lib/email-preset-sweep.test.tsx) enforces this
 * for the whole preset color space.
 */

import {
  APP_SHELL,
  BASE_THEMES,
  type BaseTheme,
  getReadableText,
  hex2hsl,
  resolveTheme,
} from "./theme";
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
  heroText: string;
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
  accent: string;
  accentFg: string;
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
  let heroText: string;
  let heroTextShadow: string | undefined;
  let heroFallback: string;
  if (base === "DARK") {
    heroGradient = t.pageBg;
    heroText = t.textPrimary; // #ffffff
    heroFallback = hslToHex(fromHsl.h, Math.min(fromHsl.s, 20), 9);
  } else if (base === "SOFT") {
    heroGradient = t.avatarGradient;
    heroText = getReadableText(gradientFrom);
    heroFallback = gradientFrom;
  } else {
    heroGradient = t.pageDecorationBg1;
    heroText = t.heroText ?? "#ffffff";
    heroTextShadow = t.heroTextShadow;
    heroFallback = gradientFrom;
  }

  return {
    base,
    canvasBg: "#f4f4f7",
    bodyBg: "#ffffff",
    heroGradient,
    heroFallback,
    heroText,
    heroTextShadow,
    coverImageUrl: input?.coverImageUrl ? absoluteUrl(input.coverImageUrl) : undefined,
    headingFont:
      customFont?.emailStack ?? (t.headingFont === "inherit" ? EMAIL_BODY_FONT : t.headingFont),
    bodyFont: EMAIL_BODY_FONT,
    headingWeight: base === "BOLD" ? "900" : "700",
    headingTransform: base === "BOLD" ? "uppercase" : "none",
    // Body copy sits on the light card, not the themed page — fixed readable inks.
    textPrimary: "#18181b",
    textSecondary: "#52525b",
    textMuted: "#8b8b94",
    accent: t.accent,
    accentFg: t.accentFg,
    accentSoftBg: solidTint(accentColor, 94),
    accentBorder: solidTint(accentColor, 82),
    // SOFT gets full pills; DARK/BOLD carry the web button radius + weight.
    btnRadius: base === "SOFT" ? "999px" : t.btnRadius,
    btnFontWeight: t.btnFontWeight,
    btnTransform: t.btnTransform,
    cardBg: "#f8f8fa",
    cardBorder: "#e6e6ec",
    cardRadius: "12px",
    avatarGradient: t.avatarGradient,
    avatarFallback: gradientFrom,
    avatarText: getReadableText(gradientFrom),
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
