import { render } from "@react-email/render";
import type * as React from "react";

/** Render a template to both HTML and a plain-text alternative part. */
export async function renderEmail(
  element: React.ReactElement
): Promise<{ html: string; text: string }> {
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text };
}

/**
 * Replace `{name}` placeholders with values. Unknown placeholders are left
 * literal so a typo is visible instead of silently vanishing. The result is
 * only ever rendered as React text nodes — never as HTML — so user-provided
 * copy cannot inject markup.
 */
export function substitutePlaceholders(
  template: string,
  vars: Record<string, string | undefined>
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
}

/** Split editable body copy into paragraphs on blank/newline boundaries. */
export function splitParagraphs(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
