// Build-time self-hosted fonts for event heading typography.
//
// Each loader defines the CSS variable declared in lib/fonts.ts (the pure-data
// registry — keep the two files in sync). `preload: false` means no <link
// rel=preload> is emitted; a font's .woff2 only downloads on pages whose CSS
// actually uses its variable, so guests never pay for fonts their event
// doesn't use. No runtime requests ever go to Google (self-hosted at build).
// Roboto is bundled locally because Google's extensionless /l/font URLs break
// the Next.js 16.3 Google font parser. See font-files/README.md for provenance.

import localFont from "next/font/local";

import {
  Playfair_Display,
  DM_Serif_Display,
  Lora,
  Bebas_Neue,
  Righteous,
  Fredoka,
  Pacifico,
  Dancing_Script,
  Caveat,
  Space_Grotesk,
  Outfit,
} from "next/font/google";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  preload: false,
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  preload: false,
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

const righteous = Righteous({
  variable: "--font-righteous",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  preload: false,
});

const pacifico = Pacifico({
  variable: "--font-pacifico",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

const dancingScript = Dancing_Script({
  variable: "--font-dancing-script",
  subsets: ["latin"],
  preload: false,
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  preload: false,
});

const roboto = localFont({
  src: "./font-files/roboto-normal.woff2",
  variable: "--font-roboto",
  weight: "400 700",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Arial",
  preload: false,
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  preload: false,
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  preload: false,
});

/** Class string exposing every theme font's CSS variable — applied on <html>. */
export const themeFontVariables = [
  playfair,
  dmSerif,
  lora,
  bebas,
  righteous,
  fredoka,
  pacifico,
  dancingScript,
  caveat,
  roboto,
  spaceGrotesk,
  outfit,
]
  .map((f) => f.variable)
  .join(" ");
