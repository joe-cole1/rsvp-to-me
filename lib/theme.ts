export type BaseTheme = "DARK" | "SOFT" | "BOLD";

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

  // Typography
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  headingFont: string;

  // Accent
  accent: string;
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
  const { r, g, b } = hex2rgb(accent);
  const accentRgb = `${r},${g},${b}`;

  if (base === "DARK") {
    return {
      pageBg: "linear-gradient(135deg, #0a0a0f 0%, #13091f 40%, #0d1117 100%)",
      pageDecoration: "dark-orbs",
      textPrimary: "#ffffff",
      textSecondary: "#a1a1aa",
      textMuted: "#71717a",
      headingFont: "inherit",
      accent,
      accentFg: "#ffffff",
      accentBg: `rgba(${accentRgb},0.15)`,
      accentBorder: `rgba(${accentRgb},0.3)`,
      accentShadow: `0 0 24px rgba(${accentRgb},0.35)`,
      cardBg: "rgba(255,255,255,0.05)",
      cardBorder: `rgba(${accentRgb},0.2)`,
      cardRadius: "20px",
      cardShadow: "none",
      inputBg: "rgba(255,255,255,0.06)",
      inputBorder: "rgba(255,255,255,0.1)",
      inputText: "#ffffff",
      inputPlaceholder: "#71717a",
      pillBg: "rgba(255,255,255,0.06)",
      pillBorder: "rgba(255,255,255,0.08)",
      badgeBg: `rgba(${accentRgb},0.2)`,
      badgeText: accent,
      btnRadius: "14px",
      btnFontWeight: "700",
      btnTransform: "none",
      avatarGradient: `linear-gradient(135deg, ${accent}, #ec4899)`,
    };
  }

  if (base === "SOFT") {
    // Lighten accent for soft theme backgrounds
    const lightAccent = `rgba(${accentRgb},0.4)`;
    return {
      pageBg: "#faf7f5",
      pageDecoration: "soft-blobs",
      textPrimary: "#1c1917",
      textSecondary: "#57534e",
      textMuted: "#a8a29e",
      headingFont: "Georgia, 'Times New Roman', serif",
      accent,
      accentFg: "#1c1917",
      accentBg: `rgba(${accentRgb},0.15)`,
      accentBorder: `rgba(${accentRgb},0.3)`,
      accentShadow: `0 4px 20px rgba(${accentRgb},0.35)`,
      cardBg: "rgba(255,255,255,0.8)",
      cardBorder: "rgba(0,0,0,0.06)",
      cardRadius: "24px",
      cardShadow: "0 4px 24px rgba(0,0,0,0.06)",
      inputBg: "rgba(0,0,0,0.04)",
      inputBorder: "rgba(0,0,0,0.08)",
      inputText: "#1c1917",
      inputPlaceholder: "#a8a29e",
      pillBg: lightAccent,
      pillBorder: "rgba(0,0,0,0.06)",
      badgeBg: "rgba(0,0,0,0.06)",
      badgeText: "#78716c",
      btnRadius: "18px",
      btnFontWeight: "700",
      btnTransform: "none",
      avatarGradient: `linear-gradient(135deg, rgba(${accentRgb},0.7), rgba(${accentRgb},0.4))`,
    };
  }

  // BOLD
  return {
    pageBg: "#fafafa",
    pageDecoration: "bold-hero" as const,
    textPrimary: "#0a0a0a",
    textSecondary: "#52525b",
    textMuted: "#a1a1aa",
    headingFont: "inherit",
    accent,
    accentFg: "#ffffff",
    accentBg: `rgba(${accentRgb},0.12)`,
    accentBorder: `rgba(${accentRgb},0.25)`,
    accentShadow: "none",
    cardBg: "#ffffff",
    cardBorder: "transparent",
    cardRadius: "24px",
    cardShadow: "0 8px 40px rgba(0,0,0,0.13)",
    inputBg: "#ffffff",
    inputBorder: "#e4e4e7",
    inputText: "#0a0a0a",
    inputPlaceholder: "#a1a1aa",
    pillBg: `rgba(${accentRgb},0.12)`,
    pillBorder: "transparent",
    badgeBg: `rgba(${accentRgb},0.12)`,
    badgeText: accent,
    btnRadius: "14px",
    btnFontWeight: "900",
    btnTransform: "uppercase",
    avatarGradient: accent,
  };
}
