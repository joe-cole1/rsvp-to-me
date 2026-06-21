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
  { name: "Purple",  value: "#a855f7", suggestedSecondary: "#ec4899" },
  { name: "Pink",    value: "#ec4899", suggestedSecondary: "#f97316" },
  { name: "Indigo",  value: "#6366f1", suggestedSecondary: "#06b6d4" },
  { name: "Sky",     value: "#0ea5e9", suggestedSecondary: "#6366f1" },
  { name: "Teal",    value: "#14b8a6", suggestedSecondary: "#0ea5e9" },
  { name: "Green",   value: "#22c55e", suggestedSecondary: "#84cc16" },
  { name: "Lime",    value: "#84cc16", suggestedSecondary: "#22c55e" },
  { name: "Orange",  value: "#f97316", suggestedSecondary: "#ec4899" },
  { name: "Red",     value: "#ef4444", suggestedSecondary: "#f97316" },
  { name: "Rose",    value: "#f43f5e", suggestedSecondary: "#a855f7" },
  { name: "Amber",   value: "#f59e0b", suggestedSecondary: "#f97316" },
  { name: "Cyan",    value: "#06b6d4", suggestedSecondary: "#0ea5e9" },
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
  secondaryAccent: string;
  secondaryAccentRgb: string;
  accentRgb: string;
  accentFg: string; // text on accent background
  accentBg: string; // subtle accent background
  accentBorder: string;
  accentShadow: string;
  accentText: string;

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

  // Optional seasonal decoration variant
  decorationVariant?: string;
}

export interface ThemePreset {
  id: string;
  label: string;
  icon: string;          // emoji icon for the picker
  description: string;   // one-line description shown in picker
  seasonal?: boolean;    // if true, shown under "Seasonal" section
  month?: number;        // 1-indexed (1 = Jan, 12 = Dec), approximate start of season or date of holiday
  config: {
    base: BaseTheme;
    accent: string;
    secondaryColor: string;
  };
  decorationVariant?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "custom",
    label: "Custom",
    icon: "🎨",
    description: "Build your own theme",
    seasonal: false,
    config: { base: "DARK", accent: "#a855f7", secondaryColor: "#ec4899" },
  },
  // --- SEASONAL ---
  {
    id: "spring",
    label: "Spring",
    icon: "🌱",
    description: "Fresh greens and soft blossoms",
    seasonal: true,
    month: 3, // March
    config: { base: "SOFT", accent: "#10b981", secondaryColor: "#fb7185" },
  },
  {
    id: "stpatricks",
    label: "St. Patrick's Day",
    icon: "🍀",
    description: "Emerald greens and gold",
    seasonal: true,
    month: 3, // March
    config: { base: "DARK", accent: "#15803d", secondaryColor: "#eab308" },
  },
  {
    id: "cherryblossom",
    label: "Cherry Blossom",
    icon: "🌸",
    description: "Delicate spring pinks",
    seasonal: true,
    month: 4, // April
    config: { base: "SOFT", accent: "#fda4af", secondaryColor: "#f472b6" },
  },
  {
    id: "summer",
    label: "Summer Vibes",
    icon: "☀️",
    description: "Bright and electric sun",
    seasonal: true,
    month: 6, // June
    config: { base: "BOLD", accent: "#f97316", secondaryColor: "#0ea5e9" },
  },
  {
    id: "july4th",
    label: "Fourth of July",
    icon: "🎆",
    description: "Patriotic red, white, and blue",
    seasonal: true,
    month: 7, // July
    config: { base: "DARK", accent: "#ef4444", secondaryColor: "#3b82f6" },
  },
  {
    id: "fall",
    label: "Fall",
    icon: "🍂",
    description: "Cozy amber and rustic copper",
    seasonal: true,
    month: 9, // September
    config: { base: "BOLD", accent: "#d97706", secondaryColor: "#7c2d12" },
  },
  {
    id: "halloween",
    label: "Halloween",
    icon: "🎃",
    description: "Spooky orange and purple",
    seasonal: true,
    month: 10, // October
    config: { base: "DARK", accent: "#ea580c", secondaryColor: "#7c3aed" },
    decorationVariant: "bats",
  },
  {
    id: "thanksgiving",
    label: "Thanksgiving",
    icon: "🦃",
    description: "Warm harvest tones",
    seasonal: true,
    month: 11, // November
    config: { base: "BOLD", accent: "#c2410c", secondaryColor: "#854d0e" },
  },
  {
    id: "winter",
    label: "Winter",
    icon: "❄️",
    description: "Chilly blues and frosted white",
    seasonal: true,
    month: 12, // December
    config: { base: "DARK", accent: "#38bdf8", secondaryColor: "#1e293b" },
    decorationVariant: "snowflakes",
  },
  {
    id: "christmas",
    label: "Christmas",
    icon: "🎄",
    description: "Classic red and green",
    seasonal: true,
    month: 12, // December
    config: { base: "DARK", accent: "#dc2626", secondaryColor: "#16a34a" },
    decorationVariant: "snowflakes",
  },
  {
    id: "newyears",
    label: "New Year's Eve",
    icon: "🥂",
    description: "Gold and midnight glamour",
    seasonal: true,
    month: 12, // December
    config: { base: "DARK", accent: "#eab308", secondaryColor: "#312e81" },
  },
  {
    id: "valentine",
    label: "Valentine's Day",
    icon: "💝",
    description: "Romantic pinks and reds",
    seasonal: true,
    month: 2, // February
    config: { base: "SOFT", accent: "#e11d48", secondaryColor: "#fb7185" },
    decorationVariant: "hearts",
  },
  // --- GENERAL / LOOKS ---
  {
    id: "retro",
    label: "Retro Synthwave",
    icon: "🎛️",
    description: "Neon pink, cyan, and deep purple",
    seasonal: false,
    config: { base: "DARK", accent: "#ec4899", secondaryColor: "#06b6d4" },
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    icon: "🤖",
    description: "High-tech neon yellow and purple",
    seasonal: false,
    config: { base: "DARK", accent: "#facc15", secondaryColor: "#a855f7" },
  },
  {
    id: "midnight",
    label: "Midnight",
    icon: "🌙",
    description: "Dark and mysterious",
    seasonal: false,
    config: { base: "DARK", accent: "#6366f1", secondaryColor: "#ec4899" },
  },
  {
    id: "ocean",
    label: "Ocean Breeze",
    icon: "🌊",
    description: "Teal to indigo depths",
    seasonal: false,
    config: { base: "DARK", accent: "#0ea5e9", secondaryColor: "#6366f1" },
  },
  {
    id: "sunset",
    label: "Sunset",
    icon: "🌅",
    description: "Golden hour warmth",
    seasonal: false,
    config: { base: "BOLD", accent: "#f97316", secondaryColor: "#ec4899" },
  },
  {
    id: "garden",
    label: "Garden Party",
    icon: "🌿",
    description: "Fresh and botanical",
    seasonal: false,
    config: { base: "SOFT", accent: "#22c55e", secondaryColor: "#84cc16" },
  },
];

export function getSortedPresets(now: Date = new Date()): ThemePreset[] {
  const currentMonth = now.getMonth() + 1; // 1-indexed

  return [...THEME_PRESETS].sort((a, b) => {
    if (a.id === "custom") return -1;
    if (b.id === "custom") return 1;

    const aSeasonal = a.seasonal && a.month !== undefined;
    const bSeasonal = b.seasonal && b.month !== undefined;

    if (aSeasonal && bSeasonal) {
      const distA = (a.month! - currentMonth + 12) % 12;
      const distB = (b.month! - currentMonth + 12) % 12;
      if (distA === distB) {
        return a.id.localeCompare(b.id);
      }
      return distA - distB;
    }

    if (aSeasonal) return -1;
    if (bSeasonal) return 1;

    return a.label.localeCompare(b.label);
  });
}

function getRelativeLuminance(hex: string): number {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const r = toLinear(parseInt(h.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(h.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(h.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getReadableText(bgHex: string): "#ffffff" | "#0a0a0a" {
  const L = getRelativeLuminance(bgHex);
  const whiteContrast = (1.05) / (L + 0.05);
  const darkContrast = (L + 0.05) / (0.05 + 0.05);
  return whiteContrast >= darkContrast ? "#ffffff" : "#0a0a0a";
}

function hsl2rgb(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4)),
  };
}

export function resolveTheme(
  base: BaseTheme,
  accent: string,
  secondaryAccent?: string | null,
  presetId?: string | null
): ResolvedTheme {
  // Helper: parse hex to rgb numbers
  const hex2rgb = (hex: string) => {
    let h = hex.replace("#", "");
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  };

  // Helper: parse hex to hsl numbers
  const hex2hsl = (hex: string) => {
    let h = hex.replace("#", "");
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
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

  // Determine secondary color
  const secondary = secondaryAccent ?? (() => {
    const { h: sh, s: ss, l: sl } = hex2hsl(accent);
    return `hsl(${(sh + 40) % 360}, ${ss}%, ${sl}%)`;
  })();

  let secondaryHex = "";
  if (secondary.startsWith("#")) {
    secondaryHex = secondary;
  } else {
    const match = secondary.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const sh = parseInt(match[1]);
      const ss = parseInt(match[2]);
      const sl = parseInt(match[3]);
      const { r: sR, g: sG, b: sB } = hsl2rgb(sh, ss, sl);
      const toHex = (val: number) => val.toString(16).padStart(2, "0");
      secondaryHex = `#${toHex(sR)}${toHex(sG)}${toHex(sB)}`;
    } else {
      secondaryHex = accent;
    }
  }

  const { r: sr, g: sg, b: sb } = hex2rgb(secondaryHex);
  const secondaryAccentRgb = `${sr},${sg},${sb}`;
  const secondaryRgb = secondaryAccentRgb;
  const { h: sh, s: ss, l: sl } = hex2hsl(secondaryHex);

  // Compute text-safe accent Text
  const accentText = l > 55
    ? `hsl(${h}, ${Math.min(s + 10, 90)}%, ${Math.max(l - 38, 22)}%)`
    : accent;

  // Compute preset/decoration variant
  let decorationVariant: string | undefined;
  if (presetId && presetId !== "custom") {
    const preset = THEME_PRESETS.find(p => p.id === presetId);
    if (preset) {
      decorationVariant = preset.decorationVariant;
    }
  } else {
    const preset = THEME_PRESETS.find(p => p.config.base === base && p.config.accent === accent && p.config.secondaryColor === secondaryHex);
    if (preset) {
      decorationVariant = preset.decorationVariant;
    }
  }

  // Accent Fg logic
  const accentFg = getReadableText(accent);

  if (base === "DARK") {
    const pageBg = `linear-gradient(135deg, hsl(${h}, ${Math.min(s, 16)}%, 5%) 0%, hsl(${Math.round((h + sh) / 2) % 360}, ${Math.min(s, 10)}%, 7%) 50%, hsl(${sh}, ${Math.min(s, 6)}%, 4%) 100%)`;
    return {
      pageBg,
      pageDecoration: "dark-orbs",
      pageDecorationBg1: `radial-gradient(circle, hsla(${h}, ${s}%, ${l}%, 0.12) 0%, transparent 70%)`,
      pageDecorationBg2: `radial-gradient(circle, hsla(${sh}, ${ss}%, ${sl}%, 0.08) 0%, transparent 70%)`,
      textPrimary: "#ffffff",
      textSecondary: "#a1a1aa",
      textMuted: "#71717a",
      headingFont: "inherit",
      accent,
      secondaryAccent: secondaryHex,
      secondaryAccentRgb,
      accentRgb,
      accentFg,
      accentBg: `rgba(${accentRgb},0.15)`,
      accentBorder: `rgba(${accentRgb},0.3)`,
      accentShadow: `0 0 24px rgba(${accentRgb},0.35)`,
      accentText,
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
      avatarGradient: `linear-gradient(135deg, ${accent}, ${secondaryHex})`,
      decorationVariant,
    };
  }

  if (base === "SOFT") {
    const pageBg = `hsl(${h}, ${Math.min(s, 20)}%, 97.5%)`;
    return {
      pageBg,
      pageDecoration: "soft-blobs",
      pageDecorationBg1: `radial-gradient(circle, hsla(${h}, ${s}%, ${l}%, 0.15) 0%, transparent 70%)`,
      pageDecorationBg2: `radial-gradient(circle, hsla(${sh}, ${ss}%, ${sl}%, 0.12) 0%, transparent 70%)`,
      textPrimary: "#1c1917",
      textSecondary: "#44403c",
      textMuted: "#6b6b6b", // improved contrast from #87807b
      headingFont: "Georgia, 'Times New Roman', serif",
      accent,
      secondaryAccent: secondaryHex,
      secondaryAccentRgb,
      accentRgb,
      accentFg,
      accentBg: `rgba(${accentRgb},0.28)`,
      accentBorder: `rgba(${accentRgb},0.45)`,
      accentShadow: `0 4px 20px rgba(${accentRgb},0.35)`,
      accentText,
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
      avatarGradient: `linear-gradient(135deg, rgba(${accentRgb},0.8), rgba(${secondaryRgb},0.6))`,
      decorationVariant,
    };
  }

  // BOLD
  const pageBg = `hsl(${h}, ${Math.min(s, 10)}%, 98%)`;
  const isBoldLight = l > 60;
  const boldBadgeText = isBoldLight
    ? `hsl(${h}, ${Math.min(s + 10, 90)}%, ${Math.max(l - 40, 25)}%)`
    : accent;

  const boldBadgeBg = accentFg === "#0a0a0a"
    ? `linear-gradient(rgba(0,0,0,0.08), rgba(0,0,0,0.08)), rgba(${accentRgb}, 0.20)`
    : `rgba(${accentRgb}, 0.20)`;

  const boldPillBg = isBoldLight
    ? `hsla(${h}, ${Math.min(s + 10, 30)}%, ${Math.max(l - 40, 25)}%, 0.12)`
    : `hsla(${h}, ${Math.min(s, 20)}%, 92%, 0.5)`;

  const boldPillBorder = isBoldLight
    ? `hsla(${h}, ${Math.min(s + 10, 30)}%, ${Math.max(l - 40, 25)}%, 0.25)`
    : "transparent";

  const boldAvatarBg = l > 55
    ? `hsl(${h}, ${Math.min(s + 5, 90)}%, ${Math.max(l - 25, 30)}%)`
    : accent;

  return {
    pageBg,
    pageDecoration: "bold-hero" as const,
    pageDecorationBg1: `linear-gradient(160deg, ${accent} 0%, hsla(${sh}, ${ss}%, ${Math.min(sl + 10, 85)}%, 0.8) 40%, hsla(${(h - 30 + 360) % 360}, 40%, 95%, 0.5) 75%, ${pageBg} 100%)`,
    pageDecorationBg2: "none",
    textPrimary: "#0a0a0a",
    textSecondary: "#52525b",
    textMuted: "#71717a", // improved contrast from #a1a1aa
    headingFont: "inherit",
    accent,
    secondaryAccent: secondaryHex,
    secondaryAccentRgb,
    accentRgb,
    accentFg,
    accentBg: `rgba(${accentRgb},0.12)`,
    accentBorder: `rgba(${accentRgb},0.25)`,
    accentShadow: "none",
    accentText: boldBadgeText,
    cardBg: "#ffffff",
    cardBorder: `hsla(${h}, ${Math.min(s, 15)}%, 90%, 0.5)`,
    cardRadius: "24px",
    cardShadow: "0 8px 40px rgba(0,0,0,0.08)",
    inputBg: `hsla(${h}, ${Math.min(s, 10)}%, 96%, 0.5)`,
    inputBorder: `hsla(${h}, ${Math.min(s, 15)}%, 88%, 0.6)`,
    inputText: "#0a0a0a",
    inputPlaceholder: "#9ca3af", // improved contrast from #a1a1aa
    pillBg: boldPillBg,
    pillBorder: boldPillBorder,
    badgeBg: boldBadgeBg,
    badgeText: boldBadgeText,
    btnRadius: "14px",
    btnFontWeight: "900",
    btnTransform: "uppercase",
    avatarGradient: boldAvatarBg,
    decorationVariant,
  };
}
