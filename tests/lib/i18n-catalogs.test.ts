import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { parse, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { DEFAULT_LOCALE, locales } from "@/i18n/config";
// Every shipped language must be complete; #914 found Dutch missing 46 keys
// because this list was hard-coded to German and Spanish.
const translatedLocales = Object.keys(locales).filter((locale) => locale !== DEFAULT_LOCALE);
type Catalog = { [key: string]: string | Catalog };
function flatten(catalog: Catalog, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(catalog)) {
    if (["__proto__", "prototype", "constructor"].includes(key))
      throw new Error("Unsafe catalog key");
    const path = prefix ? prefix + "." + key : key;
    if (typeof value === "string") result[path] = value;
    else Object.assign(result, flatten(value, path));
  }
  return result;
}
function signature(elements: MessageFormatElement[]): string[] {
  const found = new Set<string>();
  function visit(nodes: MessageFormatElement[]) {
    for (const node of nodes) {
      if (node.type !== 0 && node.type !== 7) found.add(node.type + ":" + node.value);
      if ("options" in node) for (const option of Object.values(node.options)) visit(option.value);
      if ("children" in node) visit(node.children);
    }
  }
  visit(elements);
  return [...found].sort();
}
function selectors(elements: MessageFormatElement[]): string[] {
  const found: string[] = [];
  function visit(nodes: MessageFormatElement[]) {
    for (const node of nodes) {
      if ("options" in node) {
        found.push(
          JSON.stringify({
            type: node.type,
            value: node.value,
            options: Object.keys(node.options).sort(),
            offset: "offset" in node ? node.offset : undefined,
          })
        );
        for (const option of Object.values(node.options)) visit(option.value);
      }
      if ("children" in node) visit(node.children);
    }
  }
  visit(elements);
  return found.sort();
}
describe("registered ICU message catalogs", () => {
  const english = flatten(
    JSON.parse(readFileSync(new URL("../../messages/en-US.json", import.meta.url), "utf8"))
  );
  it("validates canonical locale metadata and local flag assets", () => {
    for (const [locale, metadata] of Object.entries(locales)) {
      expect(Intl.getCanonicalLocales(locale), locale).toEqual([locale]);
      expect(metadata.nativeName.trim().length, locale).toBeGreaterThan(0);
      expect(["ltr", "rtl"], locale).toContain(metadata.dir);
      expect(metadata.flag, locale).toMatch(/^\/[^?#]+$/);
      expect(metadata.flag.split("/"), locale).not.toContain("..");
      expect(existsSync(new URL("../../public" + metadata.flag, import.meta.url)), locale).toBe(
        true
      );
    }
  });
  it("validates every English ICU message", () => {
    for (const [key, value] of Object.entries(english))
      expect.soft(() => parse(value), key).not.toThrow();
  });
  it("checks completeness for every registered translation", () => {
    expect(translatedLocales).toEqual(expect.arrayContaining(["de-DE", "es-ES", "nl-NL"]));
  });
  it.each(translatedLocales)(
    "ships a complete %s catalog with the canonical boundary whitespace",
    (locale) => {
      const translated = flatten(
        JSON.parse(
          readFileSync(new URL("../../messages/" + locale + ".json", import.meta.url), "utf8")
        )
      );
      expect(Object.keys(translated).sort()).toEqual(Object.keys(english).sort());
      for (const [key, value] of Object.entries(translated)) {
        expect
          .soft(selectors(parse(value)), key + " selectors")
          .toEqual(selectors(parse(english[key])));
        expect
          .soft(value.match(/^\s*/)?.[0], key + " leading whitespace")
          .toBe(english[key].match(/^\s*/)?.[0]);
        expect
          .soft(value.match(/\s*$/)?.[0], key + " trailing whitespace")
          .toBe(english[key].match(/\s*$/)?.[0]);
      }
    }
  );
  for (const locale of Object.keys(locales)) {
    it(
      locale +
        " has no unknown keys and preserves ICU arguments and rich tags; missing translations use English",
      () => {
        const translated = flatten(
          JSON.parse(
            readFileSync(new URL("../../messages/" + locale + ".json", import.meta.url), "utf8")
          )
        );
        for (const [key, value] of Object.entries(translated)) {
          expect.soft(Object.hasOwn(english, key), key).toBe(true);
          let selected;
          let base;
          try {
            selected = parse(value);
            base = parse(english[key]);
          } catch (error) {
            expect.soft(String(error), locale + "." + key).toBe("valid ICU syntax");
            continue;
          }
          expect.soft(signature(selected), key).toEqual(signature(base));
        }
      }
    );
  }
});
