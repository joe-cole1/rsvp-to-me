import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { PUBLIC_EVENT_SLUG, readAuthCookies } from "./fixtures";

type CspWindow = Window & {
  __cspViolations?: string[];
  __sec9NavigationMarker?: string;
  __sec9InjectedScriptRan?: boolean;
  turnstile?: { render?: unknown };
};

function getNonce(policy: string): string {
  const matches = [...policy.matchAll(/'nonce-([^']+)'/g)];
  expect(matches).toHaveLength(1);
  return matches[0][1];
}

async function recordCspViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const cspWindow = window as CspWindow;
    cspWindow.__cspViolations = [];
    cspWindow.__sec9InjectedScriptRan = false;
    document.addEventListener("securitypolicyviolation", (event) => {
      cspWindow.__cspViolations?.push(event.violatedDirective);
    });
  });
}

async function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as CspWindow).__cspViolations ?? []);
}

async function waitForReactHandlers(locator: Locator, names: readonly string[]): Promise<void> {
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

async function assertNonceDocument(
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

async function stubTurnstileApi(page: Page): Promise<void> {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    async (route) => {
      await route.fulfill({
        contentType: "application/javascript",
        body: `window.turnstile = {
          render: function (_container, options) {
            window.setTimeout(function () { options.callback("e2e-turnstile-token"); }, 0);
            return "e2e-widget";
          },
          execute: function () {},
          remove: function () {}
        };`,
      });
    }
  );
}

test.describe("CSP nonce enforcement", () => {
  test("uses one request nonce for framework and inline scripts on public routes", async ({
    page,
  }) => {
    await assertNonceDocument(page, "/");
    await assertNonceDocument(page, "/auth/sign-in");
    await assertNonceDocument(page, `/e/${PUBLIC_EVENT_SLUG}`);

    const notFound = await assertNonceDocument(page, "/csp-does-not-exist", 404);
    expect(notFound.html).toContain("404");
  });

  test("uses a fresh nonce per document request", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:3000";
    const first = await page.request.get(`${baseURL}/auth/sign-in`);
    const second = await page.request.get(`${baseURL}/auth/sign-in`);

    const firstPolicy = first.headers()["content-security-policy"];
    const secondPolicy = second.headers()["content-security-policy"];
    expect(firstPolicy).toBeTruthy();
    expect(secondPolicy).toBeTruthy();
    expect(getNonce(secondPolicy)).not.toBe(getNonce(firstPolicy));
  });

  test("blocks parser-injected inline scripts and base URL retargeting", async ({ page }) => {
    await recordCspViolations(page);

    // An inline script added with appendChild() is non-parser-inserted. CSP3
    // allows strict-dynamic to trust that runtime path, so model HTML injection
    // by inserting the payload into the initial parser response instead.
    const attackerBasePayload = '<base href="https://csp-attacker.invalid/">';
    const injectedPayload = "<script>window.__sec9InjectedScriptRan = true;</script>";
    let interceptedDocument = false;
    let attackerRequests = 0;
    let originalPolicy: string | undefined;
    let modifiedHtml = "";
    const initialDocumentRoute = async (route: Route) => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      if (requestUrl.hostname === "csp-attacker.invalid") {
        attackerRequests += 1;
        await route.abort();
        return;
      }
      if (
        interceptedDocument ||
        request.resourceType() !== "document" ||
        requestUrl.pathname !== "/"
      ) {
        await route.continue();
        return;
      }

      interceptedDocument = true;
      const upstream = await route.fetch();
      originalPolicy = upstream.headers()["content-security-policy"];
      const upstreamHtml = await upstream.text();
      modifiedHtml = upstreamHtml
        .replace(/<head\b[^>]*>/i, (headOpening) => `${headOpening}${attackerBasePayload}`)
        .replace(/<\/head>/i, `${injectedPayload}</head>`);
      await route.fulfill({ response: upstream, body: modifiedHtml });
    };

    await page.route("**/*", initialDocumentRoute);
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response).not.toBeNull();
    expect(interceptedDocument).toBe(true);
    expect(modifiedHtml).toContain(attackerBasePayload);
    expect(modifiedHtml).toContain(injectedPayload);
    expect(modifiedHtml).toMatch(/<script\b[^>]*nonce="[^"]+"/i);

    const returnedHtml = await response!.text();
    expect(returnedHtml).toContain(attackerBasePayload);
    expect(returnedHtml).toContain(injectedPayload);

    const policy = response!.headers()["content-security-policy"];
    expect(policy).toBeTruthy();
    expect(policy).toBe(originalPolicy);
    const policyHeaders = (await response!.headersArray()).filter(
      (header) => header.name.toLowerCase() === "content-security-policy"
    );
    expect(policyHeaders).toHaveLength(1);
    expect(getNonce(policy)).toBeTruthy();

    expect(await page.evaluate(() => document.baseURI)).toBe(response!.url());
    expect(new URL(await page.evaluate(() => document.baseURI)).origin).toBe(
      new URL(response!.url()).origin
    );
    expect(attackerRequests).toBe(0);
    await expect
      .poll(async () => (await cspViolations(page)).some((directive) => directive === "base-uri"))
      .toBe(true);
    await expect
      .poll(async () =>
        (await cspViolations(page)).some((directive) => directive.startsWith("script-src"))
      )
      .toBe(true);
    expect(await page.evaluate(() => (window as CspWindow).__sec9InjectedScriptRan)).toBe(false);
    await page.unroute("**/*", initialDocumentRoute);
  });

  test("preserves real client navigation without CSP violations", async ({ page }) => {
    await recordCspViolations(page);
    await assertNonceDocument(page, "/");
    const eventLink = page
      .locator(`a[href="/e/${PUBLIC_EVENT_SLUG}"]`)
      .filter({ hasText: "E2E Test Event" });
    await expect(eventLink).toHaveCount(1);
    await expect(eventLink).toBeVisible();
    await waitForReactHandlers(eventLink, ["onClick"]);
    await page.evaluate(() => {
      (window as CspWindow).__sec9NavigationMarker = "client-navigation";
    });
    await eventLink.click();
    await expect(page).toHaveURL(new RegExp(`/e/${PUBLIC_EVENT_SLUG}$`));
    expect(await page.evaluate(() => (window as CspWindow).__sec9NavigationMarker)).toBe(
      "client-navigation"
    );
    expect(await cspViolations(page)).toEqual([]);
  });

  test("keeps the existing Server Action refresh working when CAPTCHA is disabled", async ({
    page,
  }) => {
    test.info().annotations.push({
      type: "supplemental",
      description:
        "Requires CAPTCHA to be disabled because live Siteverify is never called by E2E.",
    });
    test.skip(
      !!process.env.TURNSTILE_SITE_KEY || !!process.env.TURNSTILE_SECRET_KEY,
      "Server Action CAPTCHA flow is covered only when Turnstile is disabled"
    );

    await recordCspViolations(page);
    await page.goto("/auth/sign-in");
    const textbox = page.getByRole("textbox");
    // SSR markup can be visible before React attaches the controlled input and form handlers.
    await waitForReactHandlers(textbox, ["onChange"]);
    await waitForReactHandlers(page.locator("form"), ["onSubmit"]);
    await textbox.fill("csp-e2e@test.internal");
    await expect(textbox).toHaveValue("csp-e2e@test.internal");
    await page.getByRole("button", { name: /send/i }).click();
    await expect(page.getByText(/check your/i)).toBeVisible({ timeout: 10_000 });
    expect(await cspViolations(page)).toEqual([]);
  });

  test("loads the enabled Turnstile Script with the document nonce", async ({ page }) => {
    test.info().annotations.push({
      type: "supplemental",
      description: "Runs when both dummy Turnstile keys are supplied by the production validator.",
    });
    test.skip(
      !process.env.TURNSTILE_SITE_KEY || !process.env.TURNSTILE_SECRET_KEY,
      "Turnstile is disabled for this environment"
    );

    await stubTurnstileApi(page);
    await recordCspViolations(page);
    const assertEnabledPath = async (pathname: string) => {
      const { nonce } = await assertNonceDocument(page, pathname);

      await expect
        .poll(() =>
          page.evaluate(() => typeof (window as CspWindow).turnstile?.render === "function")
        )
        .toBe(true);

      const turnstileScript = page.locator(
        'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]'
      );
      await expect
        .poll(() => turnstileScript.evaluate((script) => (script as HTMLScriptElement).nonce))
        .toBe(nonce);
      expect(await cspViolations(page)).toEqual([]);
    };

    await assertEnabledPath("/auth/sign-in");
    await assertEnabledPath("/auth/register");
    await assertEnabledPath(`/e/${PUBLIC_EVENT_SLUG}`);
    await page.context().addCookies(readAuthCookies());
    await assertEnabledPath("/dashboard");

    await page.context().clearCookies();
    await assertNonceDocument(page, "/");
    expect(await page.evaluate(() => typeof (window as CspWindow).turnstile)).toBe("undefined");
    const eventLink = page
      .locator(`a[href="/e/${PUBLIC_EVENT_SLUG}"]`)
      .filter({ hasText: "E2E Test Event" });
    await expect(eventLink).toHaveCount(1);
    await expect(eventLink).toBeVisible();
    await waitForReactHandlers(eventLink, ["onClick"]);
    await page.evaluate(() => {
      (window as CspWindow).__sec9NavigationMarker = "client-navigation";
    });
    await eventLink.click();
    await expect(page).toHaveURL(new RegExp(`/e/${PUBLIC_EVENT_SLUG}$`));
    expect(await page.evaluate(() => (window as CspWindow).__sec9NavigationMarker)).toBe(
      "client-navigation"
    );

    // Next's trusted dynamic loader may receive a new nonce during an RSC transition;
    // strict-dynamic authorizes that loader without requiring the initial document nonce.
    await expect
      .poll(() =>
        page.evaluate(() => typeof (window as CspWindow).turnstile?.render === "function")
      )
      .toBe(true);
    const turnstileScript = page.locator(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]'
    );
    await expect
      .poll(() => turnstileScript.evaluate((script) => (script as HTMLScriptElement).nonce))
      .not.toBe("");
    expect(await cspViolations(page)).toEqual([]);
  });
});
