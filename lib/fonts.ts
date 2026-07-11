// Curated heading-font registry for event themes.
//
// This module is PURE DATA — no next/font imports — so it is safe to import
// from client components, server code, and vitest alike. The actual Google
// Font loaders live in `app/fonts.ts` (build-time self-hosted via
// next/font/google, preload disabled) and expose the CSS variables declared
// here. The `cssVar` strings are the contract between the two files.
//
// Email safety: web fonts do not render reliably in email clients, so every
// entry declares an `emailStack` used by resolveEmailTheme() per the
// degradation contract in AGENTS.md.

export type FontCategory = "serif" | "display" | "script" | "sans";

export interface FontOption {
  id: string;
  label: string;
  category: FontCategory;
  /** CSS variable defined by app/fonts.ts, e.g. "--font-playfair" */
  cssVar: string;
  /** Web fallback stack appended after the var() reference */
  fallback: string;
  /** Email-safe stack for resolveEmailTheme() */
  emailStack: string;
}

export const FONT_OPTIONS: FontOption[] = [
  // ── Elegant serif ──
  {
    id: "playfair",
    label: "Playfair Display",
    category: "serif",
    cssVar: "--font-playfair",
    fallback: "Georgia, 'Times New Roman', serif",
    emailStack: "Georgia, 'Times New Roman', serif",
  },
  {
    id: "dm-serif",
    label: "DM Serif Display",
    category: "serif",
    cssVar: "--font-dm-serif",
    fallback: "Georgia, 'Times New Roman', serif",
    emailStack: "Georgia, 'Times New Roman', serif",
  },
  {
    id: "lora",
    label: "Lora",
    category: "serif",
    cssVar: "--font-lora",
    fallback: "Georgia, 'Times New Roman', serif",
    emailStack: "Georgia, 'Times New Roman', serif",
  },
  // ── Display / poster ──
  {
    id: "bebas",
    label: "Bebas Neue",
    category: "display",
    cssVar: "--font-bebas",
    fallback: "'Arial Narrow', Impact, sans-serif",
    emailStack: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
  },
  {
    id: "righteous",
    label: "Righteous",
    category: "display",
    cssVar: "--font-righteous",
    fallback: "'Trebuchet MS', 'Helvetica Neue', sans-serif",
    emailStack: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
  },
  {
    id: "fredoka",
    label: "Fredoka",
    category: "display",
    cssVar: "--font-fredoka",
    fallback: "'Trebuchet MS', 'Comic Sans MS', sans-serif",
    emailStack: "'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif",
  },
  // ── Script / handwritten ──
  {
    id: "pacifico",
    label: "Pacifico",
    category: "script",
    cssVar: "--font-pacifico",
    fallback: "'Brush Script MT', cursive",
    emailStack: "'Brush Script MT', 'Segoe Script', cursive",
  },
  {
    id: "dancing-script",
    label: "Dancing Script",
    category: "script",
    cssVar: "--font-dancing-script",
    fallback: "'Brush Script MT', cursive",
    emailStack: "'Brush Script MT', 'Segoe Script', cursive",
  },
  {
    id: "caveat",
    label: "Caveat",
    category: "script",
    cssVar: "--font-caveat",
    fallback: "'Comic Sans MS', cursive",
    emailStack: "'Segoe Script', 'Comic Sans MS', cursive",
  },
  // ── Modern sans ──
  {
    id: "roboto",
    label: "Roboto",
    category: "sans",
    cssVar: "--font-roboto",
    fallback: "'Helvetica Neue', Arial, sans-serif",
    emailStack: "Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    category: "sans",
    cssVar: "--font-space-grotesk",
    fallback: "'Helvetica Neue', Arial, sans-serif",
    emailStack: "'Helvetica Neue', Arial, sans-serif",
  },
  {
    id: "outfit",
    label: "Outfit",
    category: "sans",
    cssVar: "--font-outfit",
    fallback: "'Helvetica Neue', Arial, sans-serif",
    emailStack: "'Helvetica Neue', Arial, sans-serif",
  },
];

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  serif: "Elegant",
  display: "Poster",
  script: "Script",
  sans: "Modern",
};

export function getFontById(id: string | null | undefined): FontOption | null {
  if (!id) return null;
  return FONT_OPTIONS.find((f) => f.id === id) ?? null;
}

export function isValidFontId(id: string | null | undefined): boolean {
  return id == null || FONT_OPTIONS.some((f) => f.id === id);
}

/**
 * CSS font-family value for a heading font selection. Returns null when the
 * fontId is unset/unknown so resolveTheme() can fall back to the base theme's
 * default heading font.
 */
export function getHeadingFontValue(fontId: string | null | undefined): string | null {
  const font = getFontById(fontId);
  if (!font) return null;
  return `var(${font.cssVar}), ${font.fallback}`;
}
