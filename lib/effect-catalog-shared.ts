// Client-safe types and small metadata for the local effect icon library (#825).
//
// The full icon manifest and the four-language keyword corpus stay behind the
// server-only lib/effect-catalog.ts. Only this tiny module (types, the two
// collection names, the search page size) may reach client bundles.

import collectionsData from "./effect-catalog-data/collections.json";
import type { Locale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import type { LibraryCollectionId } from "./effects";

/** Fixed page size of GET /api/effects/search */
export const EFFECT_SEARCH_PAGE_SIZE = 24;
/** Longest query the search endpoint accepts (after trimming) */
export const EFFECT_SEARCH_MAX_QUERY_LENGTH = 80;

/** A library icon as the editor shows it: id, style, trusted sprite and its four labels. */
export interface LibraryIconSummary {
  id: string;
  collection: LibraryCollectionId;
  src: string;
  labels: Record<Locale, string>;
}

export interface EffectSearchResponse {
  items: LibraryIconSummary[];
  total: number;
  nextOffset: number | null;
}

/** Stable error codes of GET /api/effects/search */
export type EffectSearchErrorCode =
  "unauthorized" | "forbidden" | "invalid_request" | "rate_limited" | "search_failed";

export interface EffectSearchErrorResponse {
  error: EffectSearchErrorCode;
  /** rate_limited only: seconds until the window resets */
  retryAfter?: number;
}

const COLLECTION_NAMES: Record<string, string> = Object.fromEntries(
  collectionsData.collections.map((c) => [c.id, c.name])
);

/** "Fluent Emoji Flat" / "Noto Emoji" — proper names, never translated. */
export function libraryCollectionName(collection: string): string {
  return COLLECTION_NAMES[collection] ?? collection;
}

/** The icon's label in the interface language (English if a label is missing). */
export function libraryIconLabel(icon: LibraryIconSummary, locale: string): string {
  return icon.labels[locale as Locale] || icon.labels[DEFAULT_LOCALE] || icon.id;
}
