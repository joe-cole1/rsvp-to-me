import "server-only";

// Server-only local icon library for background effects (#825).
//
// Source of truth: the prepared, pinned data in lib/effect-catalog-data/
// (Noto Emoji 1.2.10 artwork under public/effects/library/, CLDR 49
// labels/keywords in four languages). It is
// fixed application data — no runtime download, refresh, Redis cache or
// external icon/translation service. Each server process reads it once from a
// fixed repository path (never a path built from request text) and keeps the
// manifest and the search index in memory.
//
// Two stages so public event pages stay cheap: resolving a stored selection
// needs only the icon manifest; search and editor labels load the keywords.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { locales as LOCALE_REGISTRY, resolveLocale, type Locale } from "@/i18n/config";
import {
  CUSTOM_EFFECT_ID,
  LIBRARY_COLLECTION_IDS,
  isLibraryIconIdShape,
  isTrustedLibrarySrc,
  isValidLibraryIconIdList,
  resolveEffectConfig,
  type EffectConfig,
  type LibraryCollectionId,
  type LibraryIconRef,
  type StoredEffectFields,
} from "./effects";
import {
  EFFECT_SEARCH_MAX_QUERY_LENGTH,
  EFFECT_SEARCH_PAGE_SIZE,
  type EffectSearchResponse,
  type LibraryIconSummary,
} from "./effect-catalog-shared";

const DATA_DIR = path.join(process.cwd(), "lib", "effect-catalog-data");

/** Closed map: one prepared language file per supported interface locale. */
const LOCALE_FILES: Record<Locale, string> = {
  "en-US": "en-US.json",
  "nl-NL": "nl-NL.json",
  "de-DE": "de-DE.json",
  "es-ES": "es-ES.json",
};
const CATALOG_LOCALES = Object.keys(LOCALE_REGISTRY) as Locale[];

interface IconRecord {
  id: string;
  collection: LibraryCollectionId;
  name: string;
  unicode: string;
  character: string;
  src: string;
  width: number;
  height: number;
}

interface LocaleRecord {
  label: string;
  keywords: string[];
}

interface Manifest {
  icons: IconRecord[];
  byId: Map<string, IconRecord>;
}

interface IndexedIcon {
  icon: IconRecord;
  labels: Record<Locale, string>;
  foldedLabels: Record<Locale, string>;
  /** Human-readable English source name, folded ("cat-face" → "cat face") */
  foldedName: string;
  /** " word word …" over names, labels and keywords of all four languages */
  searchText: string;
  /** The emoji sequence with only variation selectors removed */
  characterNoVs: string;
}

interface SearchIndex {
  manifest: Manifest;
  entries: IndexedIcon[];
  byId: Map<string, IndexedIcon>;
}

// ── Text folding ──────────────────────────────────────────────────────────────

/**
 * Case-, accent- and punctuation-insensitive form for matching: NFKD without
 * combining marks, lower case, ß → ss, every run of non-letters/digits
 * (hyphens, apostrophes, whitespace) → one space. Query text is only ever
 * compared as data, never compiled into a pattern.
 */
export function foldSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const VARIATION_SELECTORS = /[︎️]/g;
// Pictographs, regional-indicator flag letters, skin tones and the keycap mark.
const EMOJI_QUERY = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}⃣]/u;

// ── Loading (once per process) ────────────────────────────────────────────────

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8")) as T;
}

let manifestPromise: Promise<Manifest> | null = null;
let indexPromise: Promise<SearchIndex> | null = null;

async function buildManifest(): Promise<Manifest> {
  const data = await readJson<{ schemaVersion: number; icons: IconRecord[] }>("icons.json");
  if (data.schemaVersion !== 1) throw new Error("Unsupported effect catalog schema");
  const allowed = new Set<string>(LIBRARY_COLLECTION_IDS);
  // Defense in depth: anything that doesn't look like prepared local art is dropped.
  const icons = data.icons.filter(
    (icon) =>
      allowed.has(icon.collection) &&
      isLibraryIconIdShape(icon.id) &&
      icon.id === `${icon.collection}:${icon.name}` &&
      isTrustedLibrarySrc(icon.src)
  );
  return { icons, byId: new Map(icons.map((icon) => [icon.id, icon])) };
}

export function loadEffectManifest(): Promise<Manifest> {
  manifestPromise ??= buildManifest().catch((error) => {
    manifestPromise = null; // let a later request retry
    throw error;
  });
  return manifestPromise;
}

async function buildIndex(): Promise<SearchIndex> {
  const manifest = await loadEffectManifest();
  const localeData = await Promise.all(
    CATALOG_LOCALES.map(async (locale) => {
      const data = await readJson<{ schemaVersion: number; icons: Record<string, LocaleRecord> }>(
        path.join("locales", LOCALE_FILES[locale])
      );
      if (data.schemaVersion !== 1) throw new Error("Unsupported effect catalog schema");
      return [locale, data.icons] as const;
    })
  );

  const entries = manifest.icons.map((icon): IndexedIcon => {
    const labels = {} as Record<Locale, string>;
    const foldedLabels = {} as Record<Locale, string>;
    const words = new Set<string>();
    const addWords = (text: string) => {
      for (const word of foldSearchText(text).split(" ")) if (word) words.add(word);
    };
    const foldedName = foldSearchText(icon.name);
    addWords(icon.name);
    for (const [locale, records] of localeData) {
      const record = records[icon.id];
      const label = record?.label || icon.name;
      labels[locale] = label;
      foldedLabels[locale] = foldSearchText(label);
      addWords(label);
      for (const keyword of record?.keywords ?? []) addWords(keyword);
    }
    return {
      icon,
      labels,
      foldedLabels,
      foldedName,
      searchText: ` ${[...words].join(" ")}`,
      characterNoVs: icon.character.replace(VARIATION_SELECTORS, ""),
    };
  });
  return { manifest, entries, byId: new Map(entries.map((e) => [e.icon.id, e])) };
}

export function loadEffectSearchIndex(): Promise<SearchIndex> {
  indexPromise ??= buildIndex().catch((error) => {
    indexPromise = null;
    throw error;
  });
  return indexPromise;
}

// ── Lookups ───────────────────────────────────────────────────────────────────

function toSummary(entry: IndexedIcon): LibraryIconSummary {
  return {
    id: entry.icon.id,
    collection: entry.icon.collection,
    src: entry.icon.src,
    labels: { ...entry.labels },
  };
}

/** True when every id is a real member of the prepared catalog. */
export async function areLibraryIconIdsKnown(ids: readonly string[]): Promise<boolean> {
  const { byId } = await loadEffectManifest();
  return ids.every((id) => byId.has(id));
}

/** Trusted {id, src} for the known ids, in the given order (unknown ids skipped). */
export async function getLibraryIconRefs(ids: readonly string[]): Promise<LibraryIconRef[]> {
  const { byId } = await loadEffectManifest();
  return ids.flatMap((id) => {
    const icon = byId.get(id);
    return icon ? [{ id: icon.id, src: icon.src }] : [];
  });
}

/** Editor summaries (four labels each) for the known ids, in the given order. */
export async function getLibraryIconSummaries(
  ids: readonly string[]
): Promise<LibraryIconSummary[]> {
  if (ids.length === 0) return [];
  const { byId } = await loadEffectSearchIndex();
  return ids.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [toSummary(entry)] : [];
  });
}

/**
 * The server-side resolution boundary for every event route: built-in sets
 * resolve without touching the catalog; a custom mixture resolves its stored
 * ids through the manifest. Anything malformed or unknown → no effect.
 */
export async function resolveEventEffect(
  theme: StoredEffectFields | null | undefined
): Promise<EffectConfig | null> {
  if (theme?.effectId !== CUSTOM_EFFECT_ID) return resolveEffectConfig(theme);
  if (!isValidLibraryIconIdList(theme.effectIconIds)) return null;
  try {
    return resolveEffectConfig(theme, await getLibraryIconRefs(theme.effectIconIds));
  } catch {
    // A decorative layer must never take a guest page down.
    return null;
  }
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface EffectSearchInput {
  query: string;
  locale: string;
  offset: number;
}

export async function searchLibraryIcons(input: EffectSearchInput): Promise<EffectSearchResponse> {
  const index = await loadEffectSearchIndex();
  const locale = resolveLocale(input.locale);
  const query = input.query.trim().slice(0, EFFECT_SEARCH_MAX_QUERY_LENGTH);
  if (!query) return { items: [], total: 0, nextOffset: null };

  const ranked: { entry: IndexedIcon; tier: number }[] = [];

  if (EMOJI_QUERY.test(query)) {
    // Direct emoji: the exact sequence first; only if nothing matches, ignore
    // variation selectors. Skin tones, joiners, flags and tags stay distinct.
    let matches = index.entries.filter((e) => e.icon.character === query);
    if (matches.length === 0) {
      const noVs = query.replace(VARIATION_SELECTORS, "");
      matches = index.entries.filter((e) => e.characterNoVs === noVs);
    }
    for (const entry of matches) ranked.push({ entry, tier: 0 });
  } else {
    const folded = foldSearchText(query);
    const tokens = folded.split(" ").filter(Boolean);
    if (tokens.length === 0) return { items: [], total: 0, nextOffset: null };
    for (const entry of index.entries) {
      // Every token must start a word somewhere in the icon's text.
      if (!tokens.every((token) => entry.searchText.includes(` ${token}`))) continue;
      let tier = 3;
      if (entry.foldedLabels[locale] === folded) tier = 0;
      else if (
        entry.foldedName === folded ||
        CATALOG_LOCALES.some((l) => entry.foldedLabels[l] === folded)
      )
        tier = 1;
      else if (
        entry.foldedName.startsWith(folded) ||
        CATALOG_LOCALES.some((l) => entry.foldedLabels[l].startsWith(folded))
      )
        tier = 2;
      ranked.push({ entry, tier });
    }
  }

  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  ranked.sort(
    (a, b) =>
      a.tier - b.tier ||
      collator.compare(a.entry.labels[locale], b.entry.labels[locale]) ||
      (a.entry.icon.id < b.entry.icon.id ? -1 : a.entry.icon.id > b.entry.icon.id ? 1 : 0)
  );

  const total = ranked.length;
  const offset = Math.max(0, Math.floor(input.offset));
  const items = ranked
    .slice(offset, offset + EFFECT_SEARCH_PAGE_SIZE)
    .map((r) => toSummary(r.entry));
  const next = offset + EFFECT_SEARCH_PAGE_SIZE;
  return { items, total, nextOffset: next < total ? next : null };
}

/** Upper bound for a valid search offset (the catalog size). */
export async function effectCatalogSize(): Promise<number> {
  return (await loadEffectManifest()).icons.length;
}
