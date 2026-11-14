import { expect, type Locator, type Page } from "@playwright/test";

export type CspWindow = Window & {
  __cspViolations?: string[];
  __sec9NavigationMarker?: string;
  __sec9InjectedScriptRan?: boolean;
  turnstile?: { render?: unknown };
};

export function getNonce(policy: string): string {
  const matches = [...policy.matchAll(/'nonce-([^']+)'/g)];
  expect(matches).toHaveLength(1);
  return matches[0][1];
}

export async function recordCspViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const cspWindow = window as CspWindow;
    cspWindow.__cspViolations = [];
    cspWindow.__sec9InjectedScriptRan = false;
    document.addEventListener("securitypolicyviolation", (event) => {
      cspWindow.__cspViolations?.push(event.violatedDirective);
    });
  });
}

export async function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as CspWindow).__cspViolations ?? []);
}

export async function waitForReactHandlers(
  locator: Locator,
  names: readonly string[]
): Promise<void> {
  await expect
    .poll(() =>
      locator.evaluate(
        (element, handlerNames: string[]) => {
          const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
          const props = propsKey
            ? (element as unknown as Record<string, unknown>)[propsKey]
            : undefined;
          if (!props || typeof props !== "object") {
            return false;
          }

          const reactProps = props as Record<string, unknown>;
          return handlerNames.every((name) => typeof reactProps[name] === "function");
        },
        [...names]
      )
    )
    .toBe(true);
}

export async function assertNonceDocument(
  page: Page,
  pathname: string,
  expectedStatus = 200
): Promise<{ nonce: string; html: string }> {
  const response = await page.goto(pathname, { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response!.status()).toBe(expectedStatus);

  const policy = response!.headers()["content-security-policy"];
  expect(policy).toBeTruthy();
  const policyHeaders = (await response!.headersArray()).filter(
    (header) => header.name.toLowerCase() === "content-security-policy"
  );
  expect(policyHeaders).toHaveLength(1);
  const scriptDirective = policy!
    .split("; ")
    .find((directive) => directive.startsWith("script-src"));
  expect(scriptDirective).toBeTruthy();
  expect(scriptDirective).not.toContain("'unsafe-inline'");
  expect(scriptDirective).toContain("'strict-dynamic'");

  const nonce = getNonce(policy);
  const html = await response!.text();
  const initialScripts = [...html.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]);
  expect(initialScripts.length).toBeGreaterThan(0);
  expect(initialScripts.every((script) => script.includes(`nonce="${nonce}"`))).toBe(true);

  const inlineScripts = await page.locator("script").evaluateAll((elements) =>
    elements
      .map((element) => ({
        nonce: (element as HTMLScriptElement).nonce,
        source: element.getAttribute("src"),
      }))
      .filter((script) => script.source === null)
  );
  expect(inlineScripts.every((script) => script.nonce === nonce)).toBe(true);

  expect(html).toContain(`nonce="${nonce}"`);
  return { nonce, html };
}
