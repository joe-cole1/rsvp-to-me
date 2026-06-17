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

export const BASE_THEMES: { id: BaseTheme; label: string; preview: string }[] = [
  { id: "DARK", label: "Dark & Moody",    preview: "linear-gradient(135deg, #0a0a0f, #13091f)" },
  { id: "SOFT", label: "Soft & Dreamy",   preview: "linear-gradient(135deg, #fbcfe8, #e9d5ff)" },
  { id: "BOLD", label: "Bold & Colorful", preview: "linear-gradient(135deg, #f97316, #ec4899)" },
];

export interface ThemeConfig {
  base: BaseTheme;
  accent: string;
}

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
  accentFg: string; // text on accent background
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
}

export function resolveTheme(base: BaseTheme, accent: string): ResolvedTheme {
  // Helper: parse hex to rgb numbers
  const hex2rgb = (hex: string) => {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  };

  // Helper: parse hex to hsl numbers
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

  const { r, g, b } = hex2rgb(accent);
  const accentRgb = `${r},${g},${b}`;
  const { h, s, l } = hex2hsl(accent);

  if (base === "DARK") {
    const pageBg = `linear-gradient(135deg, hsl(${h}, ${Math.min(s, 16)}%, 5%) 0%, hsl(${h}, ${Math.min(s, 10)}%, 7%) 50%, hsl(${h}, ${Math.min(s, 6)}%, 4%) 100%)`;
    return {
      pageBg,
      pageDecoration: "dark-orbs",
      pageDecorationBg1: `radial-gradient(circle, hsla(${h}, ${s}%, ${l}%, 0.12) 0%, transparent 70%)`,
      pageDecorationBg2: `radial-gradient(circle, hsla(${(h + 40) % 360}, ${s}%, ${l}%, 0.08) 0%, transparent 70%)`,
      textPrimary: "#ffffff",
      textSecondary: "#a1a1aa",
      textMuted: "#71717a",
      headingFont: "inherit",
      accent,
      accentRgb,
      accentFg: "#ffffff",
      accentBg: `rgba(${accentRgb},0.15)`,
      accentBorder: `rgba(${accentRgb},0.3)`,
      accentShadow: `0 0 24px rgba(${accentRgb},0.35)`,
      cardBg: `hsla(${h}, ${Math.min(s, 15)}%, 10%, 0.5)`,
      cardBorder: `hsla(${h}, ${Math.min(s, 20)}%, 20%, 0.4)`,
      cardRadius: "20px",
      cardShadow: "none",
      inputBg: `hsla(${h}, ${Math.min(s, 15)}%, 8%, 0.6)`,
      inputBorder: `hsla(${h}, ${Math.min(s, 20)}%, 25%, 0.3)`,
      inputText: "#ffffff",
      inputPlaceholder: "#71717a",
      pillBg: `hsla(${h}, ${Math.min(s, 20)}%, 15%, 0.5)`,
      pillBorder: `hsla(${h}, ${Math.min(s, 20)}%, 22%, 0.3)`,
      badgeBg: `rgba(${accentRgb},0.2)`,
      badgeText: accent,
      btnRadius: "14px",
      btnFontWeight: "700",
      btnTransform: "none",
      avatarGradient: `linear-gradient(135deg, ${accent}, #ec4899)`,
    };
  }

  if (base === "SOFT") {
    const pageBg = `hsl(${h}, ${Math.min(s, 20)}%, 97.5%)`;
    return {
      pageBg,
      pageDecoration: "soft-blobs",
      pageDecorationBg1: `radial-gradient(circle, hsla(${h}, ${s}%, ${l}%, 0.15) 0%, transparent 70%)`,
      pageDecorationBg2: `radial-gradient(circle, hsla(${(h + 40) % 360}, ${s}%, ${l}%, 0.12) 0%, transparent 70%)`,
      textPrimary: "#1c1917",
      textSecondary: "#57534e",
      textMuted: "#a8a29e",
      headingFont: "Georgia, 'Times New Roman', serif",
      accent,
      accentRgb,
      accentFg: "#1c1917",
      accentBg: `rgba(${accentRgb},0.15)`,
      accentBorder: `rgba(${accentRgb},0.3)`,
      accentShadow: `0 4px 20px rgba(${accentRgb},0.35)`,
      cardBg: `hsla(${h}, ${Math.min(s, 10)}%, 99%, 0.85)`,
      cardBorder: `hsla(${h}, ${Math.min(s, 15)}%, 85%, 0.4)`,
      cardRadius: "24px",
      cardShadow: "0 4px 24px rgba(0,0,0,0.06)",
      inputBg: `hsla(${h}, ${Math.min(s, 15)}%, 92%, 0.5)`,
      inputBorder: `hsla(${h}, ${Math.min(s, 20)}%, 85%, 0.4)`,
      inputText: "#1c1917",
      inputPlaceholder: "#a8a29e",
      pillBg: `hsla(${h}, ${Math.min(s, 30)}%, 90%, 0.5)`,
      pillBorder: `hsla(${h}, ${Math.min(s, 20)}%, 82%, 0.4)`,
      badgeBg: "rgba(0,0,0,0.06)",
      badgeText: "#78716c",
      btnRadius: "18px",
      btnFontWeight: "700",
      btnTransform: "none",
      avatarGradient: `linear-gradient(135deg, rgba(${accentRgb},0.7), rgba(${accentRgb},0.4))`,
    };
  }

  // BOLD
  const pageBg = `hsl(${h}, ${Math.min(s, 10)}%, 98%)`;
  return {
    pageBg,
    pageDecoration: "bold-hero" as const,
    pageDecorationBg1: `linear-gradient(160deg, ${accent} 0%, hsla(${(h + 30) % 360}, ${s}%, ${Math.min(l + 10, 85)}%, 0.8) 40%, hsla(${(h - 30 + 360) % 360}, 40%, 95%, 0.5) 75%, ${pageBg} 100%)`,
    pageDecorationBg2: "none",
    textPrimary: "#0a0a0a",
    textSecondary: "#52525b",
    textMuted: "#a1a1aa",
    headingFont: "inherit",
    accent,
    accentRgb,
    accentFg: "#ffffff",
    accentBg: `rgba(${accentRgb},0.12)`,
    accentBorder: `rgba(${accentRgb},0.25)`,
    accentShadow: "none",
    cardBg: "#ffffff",
    cardBorder: `hsla(${h}, ${Math.min(s, 15)}%, 90%, 0.5)`,
    cardRadius: "24px",
    cardShadow: "0 8px 40px rgba(0,0,0,0.08)",
    inputBg: `hsla(${h}, ${Math.min(s, 10)}%, 96%, 0.5)`,
    inputBorder: `hsla(${h}, ${Math.min(s, 15)}%, 88%, 0.6)`,
    inputText: "#0a0a0a",
    inputPlaceholder: "#a1a1aa",
    pillBg: `hsla(${h}, ${Math.min(s, 20)}%, 92%, 0.5)`,
    pillBorder: "transparent",
    badgeBg: `rgba(${accentRgb},0.12)`,
    badgeText: accent,
    btnRadius: "14px",
    btnFontWeight: "900",
    btnTransform: "uppercase",
    avatarGradient: accent,
  };
}
