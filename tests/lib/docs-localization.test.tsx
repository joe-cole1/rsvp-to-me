// @vitest-environment jsdom
import React from "react";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { describe, expect, it, vi } from "vitest";
import { loadDocs } from "@/lib/docs";
import remarkCanonicalHeadings from "@/lib/remark-canonical-headings";
import DocsPanel from "@/components/docs/DocsPanel";
import english from "@/messages/en-US.json";
import dutch from "@/messages/nl-NL.json";
import { locales, type Locale } from "@/i18n/config";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

function renderMarkdown(content: string) {
  return renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkCanonicalHeadings]}
      rehypePlugins={[rehypeSlug]}
    >
      {content}
    </ReactMarkdown>
  );
}

function headingIds(content: string) {
  return Array.from(
    parseHtml(renderMarkdown(content)).querySelectorAll(
      "h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]"
    ),
    (heading) => heading.id
  );
}

function linkTargets(content: string) {
  return Array.from(parseHtml(renderMarkdown(content)).querySelectorAll("a[href]"), (link) =>
    link.getAttribute("href")!
  );
}

function parseHtml(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("localized documentation integrity", () => {
  it("keeps every overlay's canonical headings, links, code blocks and image targets", async () => {
    for (const locale of Object.keys(locales) as Locale[]) {
      if (locale === "en-US") continue;
      for (const audience of ["admin", "host"] as const) {
        const englishDocs = await loadDocs(audience, "en-US");
        const docs = await loadDocs(audience, locale);
        const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
        const overlayDir = path.join(process.cwd(), "docs", "locales", locale, audience);
        if (existsSync(overlayDir)) {
          for (const file of readdirSync(overlayDir).filter((name) => name.endsWith(".md"))) {
            expect(bySlug.has(file.replace(/\.md$/, "")), `${locale}/${audience}/${file}`).toBe(
              true
            );
          }
        }
        for (const doc of docs.filter((article) => article.locale !== "en-US")) {
          const canonical = englishDocs.find((article) => article.slug === doc.slug)!;
          const ids = headingIds(doc.content);
          expect(ids, `${locale}/${audience}/${doc.slug} headings`).toEqual(
            headingIds(canonical.content)
          );
          expect(new Set(ids).size).toBe(ids.length);
          expect(linkTargets(doc.content), `${doc.slug} link targets`).toEqual(
            linkTargets(canonical.content)
          );
          const blocks = (content: string) => content.match(/```[^\n]*\n[\s\S]*?```/g) ?? [];
          expect(blocks(doc.content), `${doc.slug} code blocks`).toEqual(blocks(canonical.content));
          const images = (content: string) =>
            Array.from(parseHtml(renderMarkdown(content)).querySelectorAll("img[src]"), (image) =>
              image.getAttribute("src")
            );
          expect(images(doc.content), `${doc.slug} image targets`).toEqual(
            images(canonical.content)
          );
          for (const target of linkTargets(doc.content)) {
            if (/^(?:[a-z]+:|\/)/i.test(target)) continue;
            const [targetPath, hash] = target.split("#");
            const slug = targetPath ? path.basename(targetPath, ".md") : doc.slug;
            const destination = bySlug.get(slug);
            expect(destination, `${doc.slug}: ${target}`).toBeDefined();
            if (hash)
              expect(headingIds(destination!.content), `${doc.slug}: ${target}`).toContain(hash);
          }
        }
      }
    }
  });

  it("packages locale overlays through the existing recursive Docker docs copy", () => {
    const dockerfile = readFileSync(path.join(process.cwd(), "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/COPY --from=builder \/app\/docs \.\/docs/);
    expect(existsSync(path.join(process.cwd(), "docs/locales/nl-NL/admin/localization.md"))).toBe(
      true
    );
  });

  it("preserves explicit safe anchors and ignores attribute injection or raw HTML", () => {
    const html = renderMarkdown(
      '## Inloggen {#signing-in}\n\n## Unsafe {#x" onclick="bad}\n\n<script>alert(1)</script>'
    );
    const document = parseHtml(html);
    expect(document.querySelector("h2#signing-in")?.textContent).toBe("Inloggen");
    expect(document.querySelector("[onclick], script")).toBeNull();
  });

  it("renders translated navigation but marks an English fallback article English/LTR", async () => {
    const fallback = (await loadDocs("host", "nl-NL")).find(
      (doc) => doc.slug === "creating-an-event"
    )!;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="nl-NL"
        messages={{ Ui: { Docs: dutch.Ui.Docs } }}
        timeZone="UTC"
      >
        <DocsPanel docs={[fallback]} />
      </NextIntlClientProvider>
    );
    const document = parseHtml(html);
    expect(document.querySelector("input")?.getAttribute("placeholder")).toBe(
      "Handleidingen doorzoeken…"
    );
    const article = document.querySelector(".md-body");
    expect(article?.getAttribute("lang")).toBe("en-US");
    expect(article?.getAttribute("dir")).toBe("ltr");
    expect(article?.textContent).toContain("Creating Your Event");
  });

  it("preserves a fixture article's RTL language independently from the UI locale", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="en-US"
        messages={{ Ui: { Docs: english.Ui.Docs } }}
        timeZone="UTC"
      >
        <DocsPanel
          docs={[
            {
              slug: "fixture",
              title: "دليل",
              description: "مساعدة",
              category: "Guide",
              content: "## مرحبا {#welcome}",
              locale: "ar",
              dir: "rtl",
            },
          ]}
        />
      </NextIntlClientProvider>
    );
    const document = parseHtml(html);
    const article = document.querySelector(".md-body");
    expect(article?.getAttribute("lang")).toBe("ar");
    expect(article?.getAttribute("dir")).toBe("rtl");
    expect(article?.querySelector("h2#welcome")?.textContent).toBe("مرحبا");
  });
});
