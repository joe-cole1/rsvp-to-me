import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  areLibraryIconIdsKnown,
  foldSearchText,
  getLibraryIconRefs,
  getLibraryIconSummaries,
  loadEffectManifest,
  resolveEventEffect,
  searchLibraryIcons,
} from "@/lib/effect-catalog";
import { EFFECT_SEARCH_PAGE_SIZE } from "@/lib/effect-catalog-shared";
import { CUSTOM_EFFECT_ID, LIBRARY_COLLECTION_IDS, isTrustedLibrarySrc } from "@/lib/effects";

// #825: the prepared local catalog and its search. Everything here reads the
// repository data from disk; the unit network guard fails any fetch, so this
// also proves search and resolution need no external icon or translation service.

const DATA = join(process.cwd(), "lib", "effect-catalog-data");
const LOCALES = ["en-US", "nl-NL", "de-DE", "es-ES"] as const;

async function allIds(query: string, locale = "en-US") {
  const ids: string[] = [];
  let offset: number | null = 0;
  while (offset != null) {
    const page = await searchLibraryIcons({ query, locale, offset });
    ids.push(...page.items.map((i) => i.id));
    offset = page.nextOffset;
  }
  return ids;
}

describe("prepared catalog data", () => {
  it("has 6,874 unique selectable icons in the two approved collections", async () => {
    const { icons } = await loadEffectManifest();
    expect(icons.length).toBe(6874);
    expect(new Set(icons.map((i) => i.id)).size).toBe(6874);
    const byCollection = Object.fromEntries(
      LIBRARY_COLLECTION_IDS.map((c) => [c, icons.filter((i) => i.collection === c).length])
    );
    expect(byCollection).toEqual({ "fluent-emoji-flat": 3145, noto: 3729 });
  });

  it("points every icon at a trusted local SVG that exists", async () => {
    const { icons } = await loadEffectManifest();
    for (const icon of icons) {
      expect(isTrustedLibrarySrc(icon.src), icon.id).toBe(true);
      expect(existsSync(join(process.cwd(), "public", icon.src)), icon.src).toBe(true);
    }
  });

  it("has a label and keywords for every icon in all four languages", async () => {
    const { icons } = await loadEffectManifest();
    for (const locale of LOCALES) {
      const data = JSON.parse(readFileSync(join(DATA, "locales", `${locale}.json`), "utf8"));
      expect(data.locale).toBe(locale);
      for (const icon of icons) {
        const record = data.icons[icon.id];
        expect(record?.label, `${locale} ${icon.id}`).toBeTruthy();
        expect(Array.isArray(record.keywords)).toBe(true);
      }
    }
  });

  it("ships the artwork and CLDR license notices", () => {
    for (const notice of [
      "effects/library/fluent-emoji-flat/1.2.6/LICENSE.txt",
      "effects/library/noto/1.2.10/LICENSE.txt",
      "effects/library/noto/1.2.10/NOTICE.txt",
      "effects/library/noto/1.2.10/REGION-FLAGS-LICENSE.txt",
      "effects/library/cldr/49.0.0/LICENSE.txt",
    ]) {
      expect(existsSync(join(process.cwd(), "public", notice)), notice).toBe(true);
    }
  });
});

describe("membership and resolution", () => {
  it("knows real ids and rejects syntactically valid but missing ones", async () => {
    expect(await areLibraryIconIdsKnown(["fluent-emoji-flat:cat", "noto:cat"])).toBe(true);
    expect(await areLibraryIconIdsKnown(["noto:not-a-real-icon"])).toBe(false);
    expect(await getLibraryIconRefs(["noto:cat", "noto:nope"])).toEqual([
      { id: "noto:cat", src: "/effects/library/noto/1.2.10/cat.svg" },
    ]);
  });

  it("summaries carry the four labels but never keywords or SVG", async () => {
    const [cat] = await getLibraryIconSummaries(["noto:cat"]);
    expect(cat).toEqual({
      id: "noto:cat",
      collection: "noto",
      src: "/effects/library/noto/1.2.10/cat.svg",
      labels: { "en-US": "Cat", "nl-NL": "Kat", "de-DE": "Katze", "es-ES": "Gato" },
    });
  });

  it("resolves a stored mixture to trusted sprites and fails safe otherwise", async () => {
    const config = await resolveEventEffect({
      effectId: CUSTOM_EFFECT_ID,
      effectIconIds: ["noto:red-heart", "fluent-emoji-flat:cat"],
      effectSize: 6,
    });
    expect(config).toMatchObject({
      effectId: CUSTOM_EFFECT_ID,
      size: 6,
      movement: "random",
      libraryIcons: [
        { id: "noto:red-heart", src: "/effects/library/noto/1.2.10/red-heart.svg" },
        { id: "fluent-emoji-flat:cat", src: "/effects/library/fluent-emoji-flat/1.2.6/cat.svg" },
      ],
    });
    expect(
      await resolveEventEffect({ effectId: CUSTOM_EFFECT_ID, effectIconIds: ["noto:gone"] })
    ).toBeNull();
    expect(
      await resolveEventEffect({ effectId: CUSTOM_EFFECT_ID, effectIconIds: ["../../x"] })
    ).toBeNull();
    // Built-ins and None never need the catalog
    expect((await resolveEventEffect({ effectId: "snow" }))?.movement).toBe("down");
    expect(await resolveEventEffect({ effectId: null })).toBeNull();
  });
});

describe("folding", () => {
  it("ignores case, accents, punctuation and German ß", () => {
    expect(foldSearchText("Corazón")).toBe("corazon");
    expect(foldSearchText("  Straße  ")).toBe("strasse");
    expect(foldSearchText("STRASSE")).toBe("strasse");
    expect(foldSearchText("heart-eyes")).toBe("heart eyes");
    expect(foldSearchText("Außerirdischer")).toBe("ausserirdischer");
  });
});

describe("searchLibraryIcons", () => {
  it("finds both styles of cat in all four languages, whatever the interface language", async () => {
    for (const query of ["cat", "kat", "Katze", "gato"]) {
      for (const locale of ["en-US", "de-DE"]) {
        const ids = await allIds(query, locale);
        expect(ids, `${query} (${locale})`).toContain("fluent-emoji-flat:cat");
        expect(ids, `${query} (${locale})`).toContain("noto:cat");
      }
    }
  });

  it("finds both styles of heart in all four languages, accents optional", async () => {
    for (const query of ["heart", "hart", "Herz", "corazon", "corazón"]) {
      const ids = await allIds(query, "nl-NL");
      expect(ids, query).toContain("fluent-emoji-flat:red-heart");
      expect(ids, query).toContain("noto:red-heart");
    }
  });

  it("ranks the exact label in the interface language first, Fluent before Noto", async () => {
    const page = await searchLibraryIcons({ query: "Katze", locale: "de-DE", offset: 0 });
    expect(page.items.slice(0, 2).map((i) => i.id)).toEqual(["fluent-emoji-flat:cat", "noto:cat"]);
    const en = await searchLibraryIcons({ query: "cat", locale: "en-US", offset: 0 });
    expect(en.items.slice(0, 2).map((i) => i.id)).toEqual(["fluent-emoji-flat:cat", "noto:cat"]);
  });

  it("ignores case and surrounding whitespace, and matches every word of a multiword query", async () => {
    const a = await allIds("  HEART   eyes ");
    const b = await allIds("heart eyes");
    expect(a).toEqual(b);
    expect(a).toContain("fluent-emoji-flat:smiling-face-with-heart-eyes");
    expect(a).toContain("noto:smiling-cat-with-heart-eyes");
    // Every word must match: a cat without heart eyes is not a result
    expect(a).not.toContain("noto:cat");
  });

  it("matches word starts, not arbitrary substrings", async () => {
    // "cat" must not match "application" or "education"
    const ids = await allIds("cat");
    expect(ids.some((id) => /application|education|vacation/.test(id))).toBe(false);
  });

  it("finds a pasted emoji by its exact sequence and keeps skin tones and joiners distinct", async () => {
    expect((await allIds("🐈")).sort()).toEqual(["fluent-emoji-flat:cat", "noto:cat"]);
    expect((await allIds("👋")).sort()).toEqual([
      "fluent-emoji-flat:waving-hand",
      "noto:waving-hand",
    ]);
    expect((await allIds("👋🏽")).sort()).toEqual([
      "fluent-emoji-flat:waving-hand-medium",
      "noto:waving-hand-medium-skin-tone",
    ]);
    // ZWJ sequences resolve as a whole, not as their parts
    expect((await allIds("👩‍💻")).sort()).toEqual([
      "fluent-emoji-flat:woman-technologist",
      "noto:woman-technologist",
    ]);
    // A variation selector (as most keyboards send ❤️) doesn't prevent a match
    expect((await allIds("❤️")).sort()).toEqual(["fluent-emoji-flat:red-heart", "noto:red-heart"]);
    expect((await allIds("🏳️‍🌈")).sort()).toEqual([
      "fluent-emoji-flat:rainbow-flag",
      "noto:rainbow-flag",
    ]);
  });

  it("returns nothing for empty, blank or unmatched queries", async () => {
    for (const query of ["", "   ", "zzzzqqqxx", "!!!"]) {
      expect(await searchLibraryIcons({ query, locale: "en-US", offset: 0 })).toEqual({
        items: [],
        total: 0,
        nextOffset: null,
      });
    }
  });

  it("pages in fixed steps of 24 without repeats", async () => {
    const first = await searchLibraryIcons({ query: "face", locale: "en-US", offset: 0 });
    expect(first.total).toBeGreaterThan(EFFECT_SEARCH_PAGE_SIZE * 2);
    expect(first.items).toHaveLength(EFFECT_SEARCH_PAGE_SIZE);
    expect(first.nextOffset).toBe(EFFECT_SEARCH_PAGE_SIZE);
    const second = await searchLibraryIcons({ query: "face", locale: "en-US", offset: 24 });
    const overlap = second.items.filter((i) => first.items.some((f) => f.id === i.id));
    expect(overlap).toEqual([]);
    const past = await searchLibraryIcons({ query: "face", locale: "en-US", offset: 6000 });
    expect(past).toEqual({ items: [], total: first.total, nextOffset: null });
  });

  it("orders results the same way every time", async () => {
    const a = await allIds("star", "es-ES");
    const b = await allIds("star", "es-ES");
    expect(a).toEqual(b);
  });

  it("falls back to English for an unknown locale", async () => {
    const page = await searchLibraryIcons({ query: "cat", locale: "xx-YY", offset: 0 });
    expect(page.items[0].id).toBe("fluent-emoji-flat:cat");
  });

  it("returns only summaries: no keywords, SVG bodies or extra fields", async () => {
    const page = await searchLibraryIcons({ query: "pizza", locale: "en-US", offset: 0 });
    for (const item of page.items) {
      expect(Object.keys(item).sort()).toEqual(["collection", "id", "labels", "src"]);
      expect(Object.keys(item.labels).sort()).toEqual([...LOCALES].sort());
      expect(JSON.stringify(item)).not.toMatch(/<svg|keywords/);
    }
  });
});
