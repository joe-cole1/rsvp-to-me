import { expect, test, type Route } from "@playwright/test";
import { PUBLIC_EVENT_SLUG } from "./fixtures";
import {
  assertNonceDocument,
  cspViolations,
  getNonce,
  recordCspViolations,
  waitForReactHandlers,
  type CspWindow,
} from "./csp-helpers";

test.describe("CSP nonce enforcement", () => {
  test("uses one request nonce for framework and inline scripts on public routes", async ({
    page,
  }) => {
    await assertNonceDocument(page, "/");
    await assertNonceDocument(page, "/auth/sign-in");
    await assertNonceDocument(page, `/e/${PUBLIC_EVENT_SLUG}`);

    // The app's own not-found page (#812), served with a 404 status and the request nonce.
    const notFound = await assertNonceDocument(page, "/csp-does-not-exist", 404);
    expect(notFound.html).toContain("The link may be mistyped");
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
    expect(process.env.TURNSTILE_SITE_KEY || "").toBe("");
    expect(process.env.TURNSTILE_SECRET_KEY || "").toBe("");

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
});
