export type BaseTheme = "DARK" | "SOFT" | "BOLD";

// Single source of truth for the app shell (non-event pages: dashboard, auth, home)
export const APP_SHELL = {
  pageBg: "linear-gradient(135deg, #0a0a0f 0%, #13091f 40%, #0d1117 100%)",
  accent: "#a855f7",
  accentSecondary: "#ec4899",
  textPrimary: "#ffffff",
  textSecondary: "rgba(255,255,255,0.5)",
  textMuted: "rgba(255,255,255,0.4)",
  textTertiary: "rgba(255,255,255,0.3)",
  navBorder: "rgba(255,255,255,0.08)",
  cardBg: "rgba(255,255,255,0.04)",
  cardBg2: "rgba(255,255,255,0.06)",
  cardBorder: "rgba(255,255,255,0.08)",
  cardRadius: "20px",
  itemRadius: "16px",
  authCardRadius: "24px",
  inputBg: "rgba(255,255,255,0.06)",
  inputBorder: "rgba(255,255,255,0.1)",
  inputRadius: "12px",
  btnRadius: "14px",
} as const;

export const BASE_THEMES: {
  id: BaseTheme;
  label: string;
  preview: string;
  defaultGradientFrom: string;
  defaultGradientTo: string;
  defaultAccent: string;
}[] = [
  {
    id: "DARK",
    label: "Dark & Moody",
    preview: "linear-gradient(135deg, #0a0a0f, #13091f)",
    defaultGradientFrom: "#7c3aed",
    defaultGradientTo: "#1e40af",
    defaultAccent: "#a855f7",
  },
  {
    id: "SOFT",
    label: "Soft & Dreamy",
    preview: "linear-gradient(135deg, #fbcfe8, #e9d5ff)",
    defaultGradientFrom: "#fda4af",
    defaultGradientTo: "#ddd6fe",
    defaultAccent: "#ec4899",
  },
  {
    id: "BOLD",
    label: "Bold & Colorful",
    preview: "linear-gradient(135deg, #f97316, #ec4899)",
    defaultGradientFrom: "#f97316",
    defaultGradientTo: "#ec4899",
    defaultAccent: "#f97316",
  },
];

export interface ThemeConfig {
  base: BaseTheme;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  emoji: string;
  base: BaseTheme;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  seasonal?: boolean;
}

export const THEME_PRESETS: ThemePreset[] = [
  // Dark presets
  { id: "dark-night",      name: "Dark Night",        emoji: "🌙", base: "DARK", gradientFrom: "#7c3aed", gradientTo: "#1e40af", accentColor: "#a855f7" },
  { id: "midnight-indigo", name: "Midnight Indigo",   emoji: "✨", base: "DARK", gradientFrom: "#312e81", gradientTo: "#1e1b4b", accentColor: "#818cf8" },
  { id: "obsidian",        name: "Obsidian",          emoji: "🖤", base: "DARK", gradientFrom: "#7c2d12", gradientTo: "#1c1917", accentColor: "#f97316" },
  { id: "emerald-night",   name: "Emerald Night",     emoji: "🌿", base: "DARK", gradientFrom: "#14532d", gradientTo: "#0f172a", accentColor: "#22c55e" },
  // Soft presets
  { id: "rose-cloud",      name: "Rosé Cloud",        emoji: "🌸", base: "SOFT", gradientFrom: "#fda4af", gradientTo: "#ddd6fe", accentColor: "#e11d48" },
  { id: "peach-cream",     name: "Peach Cream",       emoji: "🍑", base: "SOFT", gradientFrom: "#fde68a", gradientTo: "#fbcfe8", accentColor: "#f59e0b" },
  { id: "garden-party",    name: "Garden Party",      emoji: "🌷", base: "SOFT", gradientFrom: "#bbf7d0", gradientTo: "#a5f3fc", accentColor: "#059669" },
  { id: "lavender-fields", name: "Lavender Fields",   emoji: "💜", base: "SOFT", gradientFrom: "#e9d5ff", gradientTo: "#ddd6fe", accentColor: "#7c3aed" },
  // Bold presets
  { id: "sunset",          name: "Sunset",            emoji: "🌅", base: "BOLD", gradientFrom: "#f97316", gradientTo: "#ec4899", accentColor: "#f97316" },
  { id: "electric-blue",   name: "Electric Blue",     emoji: "⚡", base: "BOLD", gradientFrom: "#0ea5e9", gradientTo: "#6366f1", accentColor: "#0ea5e9" },
  { id: "deep-sea",        name: "Deep Sea",          emoji: "🌊", base: "BOLD", gradientFrom: "#14b8a6", gradientTo: "#6366f1", accentColor: "#0d9488" },
  // Seasonal
  { id: "valentines",      name: "Valentine's Day",   emoji: "❤️",  base: "SOFT", gradientFrom: "#fecdd3", gradientTo: "#fda4af", accentColor: "#e11d48",  seasonal: true },
  { id: "st-patricks",     name: "St. Patrick's Day", emoji: "🍀", base: "BOLD", gradientFrom: "#16a34a", gradientTo: "#15803d", accentColor: "#ca8a04",  seasonal: true },
  { id: "fourth-of-july",  name: "4th of July",       emoji: "🇺🇸", base: "BOLD", gradientFrom: "#dc2626", gradientTo: "#1d4ed8", accentColor: "#dc2626",  seasonal: true },
  { id: "halloween",       name: "Halloween",         emoji: "🎃", base: "DARK", gradientFrom: "#9a3412", gradientTo: "#1c1917", accentColor: "#f97316",  seasonal: true },
  { id: "thanksgiving",    name: "Thanksgiving",      emoji: "🦃", base: "BOLD", gradientFrom: "#b45309", gradientTo: "#92400e", accentColor: "#d97706",  seasonal: true },
  { id: "winter-holidays", name: "Winter Holidays",   emoji: "🎄", base: "DARK", gradientFrom: "#166534", gradientTo: "#0f172a", accentColor: "#fbbf24",  seasonal: true },
  { id: "new-years",       name: "New Year's Eve",    emoji: "🥂", base: "DARK", gradientFrom: "#1e1b4b", gradientTo: "#0f172a", accentColor: "#fbbf24",  seasonal: true },
];

// Curated accent color presets
export const ACCENT_PRESETS = [
  { name: "Purple",  value: "#a855f7" },
  { name: "Pink",    value: "#ec4899" },
  { name: "Indigo",  value: "#6366f1" },
  { name: "Sky",     value: "#0ea5e9" },
  { name: "Teal",    value: "#14b8a6" },
  { name: "Green",   value: "#22c55e" },
  { name: "Lime",    value: "#84cc16" },
  { name: "Orange",  value: "#f97316" },
  { name: "Red",     value: "#ef4444" },
  { name: "Rose",    value: "#f43f5e" },
  { name: "Amber",   value: "#f59e0b" },
  { name: "Cyan",    value: "#06b6d4" },
] as const;

export interface ResolvedTheme {
  // Raw inputs passed through so pickers can read them back
  gradientFrom: string;
  gradientTo: string;

  // Page background
  pageBg: string;
  pageDecoration: "dark-orbs" | "soft-blobs" | "bold-hero";
  pageDecorationBg1: string;
  pageDecorationBg2: string;

  // Typography
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  headingFont: string;

  // Accent
  accent: string;
  accentRgb: string;
  accentFg: string; // WCAG-computed text color on accent background
  accentBg: string; // subtle accent background
  accentBorder: string;
  accentShadow: string;

  // Cards
  cardBg: string;
  cardBorder: string;
  cardRadius: string;
  cardShadow: string;

  // Inputs
  inputBg: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;

  // Guest pills
  pillBg: string;
  pillBorder: string;

  // Badges
  badgeBg: string;
  badgeText: string;

  // Buttons
  btnRadius: string;
  btnFontWeight: string;
  btnTransform: string;

  // Avatar gradient
  avatarGradient: string;

  // Optional seasonal decoration hint (e.g. "bats", "snowflakes", "hearts")
  decorationVariant?: string;
}

// ── WCAG helpers ──────────────────────────────────────────────────────────────

function getRelativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const r = toLinear(parseInt(h.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(h.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(h.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getReadableText(bg: string): "#ffffff" | "#0a0a0a" {
  const L = getRelativeLuminance(bg);
  const contrastWhite = 1.05 / (L + 0.05);
  const contrastBlack = (L + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? "#ffffff" : "#0a0a0a";
}

// ── resolveTheme ──────────────────────────────────────────────────────────────

export function resolveTheme(
  base: BaseTheme,
  gradientFrom: string,
  gradientTo: string,
  accentColor: string
): ResolvedTheme {
  const hex2rgb = (hex: string) => {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  };

  const hex2hsl = (hex: string) => {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let hVal = 0;
    let sVal = 0;
    const lVal = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      sVal = lVal > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: hVal = (g - b) / d + (g < b ? 6 : 0); break;
        case g: hVal = (b - r) / d + 2; break;
        case b: hVal = (r - g) / d + 4; break;
      }
      hVal /= 6;
    }
    return {
      h: Math.round(hVal * 360),
      s: Math.round(sVal * 100),
      l: Math.round(lVal * 100),
    };
  };

  const { r: aR, g: aG, b: aB } = hex2rgb(accentColor);
  const accentRgb = `${aR},${aG},${aB}`;
  const accentFg = getReadableText(accentColor);

  const { h: h1, s: s1, l: l1 } = hex2hsl(gradientFrom);
  const { h: h2, s: s2, l: l2 } = hex2hsl(gradientTo);

  if (base === "DARK") {
    // Use hue/saturation from gradient inputs; clamp lightness very dark (8/11/7%)
    // Slightly brighter than before (was 5/7/4%)
    const pageBg = `linear-gradient(135deg, hsl(${h1},${Math.min(s1,20)}%,8%) 0%, hsl(${h2},${Math.min(s2,16)}%,11%) 50%, hsl(${h1},${Math.min(s1,12)}%,7%) 100%)`;
    // Orb glows: ensure minimum lightness so they're visible on the dark bg (0.18/0.12, was 0.12/0.08)
    const glowL1 = Math.max(l1, 55);
    const glowL2 = Math.max(l2, 55);
    return {
      gradientFrom,
      gradientTo,
      pageBg,
      pageDecoration: "dark-orbs",
      pageDecorationBg1: `radial-gradient(circle, hsla(${h1},${s1}%,${glowL1}%,0.18) 0%, transparent 70%)`,
      pageDecorationBg2: `radial-gradient(circle, hsla(${h2},${s2}%,${glowL2}%,0.12) 0%, transparent 70%)`,
      textPrimary: "#ffffff",
      textSecondary: "#a1a1aa",
      textMuted: "#71717a",
      headingFont: "inherit",
      accent: accentColor,
      accentRgb,
      accentFg,
      accentBg: `rgba(${accentRgb},0.15)`,
      accentBorder: `rgba(${accentRgb},0.3)`,
      accentShadow: `0 0 24px rgba(${accentRgb},0.35)`,
      cardBg: `hsla(${h1},${Math.min(s1,15)}%,10%,0.5)`,
      cardBorder: `hsla(${h1},${Math.min(s1,20)}%,20%,0.4)`,
      cardRadius: "20px",
      cardShadow: "none",
      inputBg: `hsla(${h1},${Math.min(s1,15)}%,8%,0.6)`,
      inputBorder: `hsla(${h1},${Math.min(s1,20)}%,25%,0.3)`,
      inputText: "#ffffff",
      inputPlaceholder: "#71717a",
      pillBg: `hsla(${h1},${Math.min(s1,20)}%,15%,0.5)`,
      pillBorder: `hsla(${h1},${Math.min(s1,20)}%,22%,0.3)`,
      badgeBg: `rgba(${accentRgb},0.2)`,
      badgeText: accentColor,
      btnRadius: "14px",
      btnFontWeight: "700",
      btnTransform: "none",
      avatarGradient: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
    };
  }

  if (base === "SOFT") {
    // Page bg: very light tint from gradientFrom hue; blobs use the actual colors
    const pageBg = `hsl(${h1},${Math.min(s1,20)}%,97.5%)`;
    const blobL1 = Math.min(l1, 82);
    const blobL2 = Math.min(l2, 82);
    return {
      gradientFrom,
      gradientTo,
      pageBg,
      pageDecoration: "soft-blobs",
      pageDecorationBg1: `radial-gradient(circle, hsla(${h1},${s1}%,${blobL1}%,0.55) 0%, transparent 70%)`,
      pageDecorationBg2: `radial-gradient(circle, hsla(${h2},${s2}%,${blobL2}%,0.4) 0%, transparent 70%)`,
      textPrimary: "#1c1917",
      textSecondary: "#44403c",
      textMuted: "#87807b",
      headingFont: "Georgia, 'Times New Roman', serif",
      accent: accentColor,
      accentRgb,
      accentFg,
      accentBg: `rgba(${accentRgb},0.18)`,
      accentBorder: `rgba(${accentRgb},0.35)`,
      accentShadow: `0 4px 20px rgba(${accentRgb},0.3)`,
      cardBg: "rgba(255,255,255,0.85)",
      cardBorder: `hsla(${h1},${Math.min(s1,15)}%,85%,0.5)`,
      cardRadius: "24px",
      cardShadow: "0 4px 24px rgba(0,0,0,0.06)",
      inputBg: `hsla(${h1},${Math.min(s1,15)}%,92%,0.5)`,
      inputBorder: `hsla(${h1},${Math.min(s1,20)}%,85%,0.4)`,
      inputText: "#1c1917",
      inputPlaceholder: "#a8a29e",
      pillBg: `hsla(${h1},${Math.min(s1,30)}%,90%,0.5)`,
      pillBorder: `hsla(${h1},${Math.min(s1,20)}%,82%,0.4)`,
      badgeBg: "rgba(0,0,0,0.06)",
      badgeText: "#78716c",
      btnRadius: "18px",
      btnFontWeight: "700",
      btnTransform: "none",
      avatarGradient: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
    };
  }

  // BOLD: hero strip uses gradientFrom → gradientTo directly; white card below
  const pageBg = `hsl(${h1},${Math.min(s1,10)}%,98%)`;
  return {
    gradientFrom,
    gradientTo,
    pageBg,
    pageDecoration: "bold-hero",
    pageDecorationBg1: `linear-gradient(160deg, ${gradientFrom} 0%, ${gradientTo} 50%, ${pageBg} 100%)`,
    pageDecorationBg2: "none",
    textPrimary: "#0a0a0a",
    textSecondary: "#52525b",
    textMuted: "#a1a1aa",
    headingFont: "inherit",
    accent: accentColor,
    accentRgb,
    accentFg,
    accentBg: `rgba(${accentRgb},0.12)`,
    accentBorder: `rgba(${accentRgb},0.25)`,
    accentShadow: "none",
    cardBg: "#ffffff",
    cardBorder: `hsla(${h1},${Math.min(s1,15)}%,90%,0.5)`,
    cardRadius: "24px",
    cardShadow: "0 8px 40px rgba(0,0,0,0.08)",
    inputBg: `hsla(${h1},${Math.min(s1,10)}%,96%,0.5)`,
    inputBorder: `hsla(${h1},${Math.min(s1,15)}%,88%,0.6)`,
    inputText: "#0a0a0a",
    inputPlaceholder: "#a1a1aa",
    pillBg: `hsla(${h1},${Math.min(s1,20)}%,92%,0.5)`,
    pillBorder: "transparent",
    badgeBg: `rgba(${accentRgb},0.12)`,
    badgeText: accentColor,
    btnRadius: "14px",
    btnFontWeight: "900",
    btnTransform: "uppercase",
    avatarGradient: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
  };
}
