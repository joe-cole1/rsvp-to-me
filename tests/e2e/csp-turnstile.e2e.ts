import { expect, test, type Page } from "@playwright/test";
import { PUBLIC_EVENT_SLUG, readAuthCookies } from "./fixtures";
import {
  assertNonceDocument,
  cspViolations,
  recordCspViolations,
  waitForReactHandlers,
  type CspWindow,
} from "./csp-helpers";

async function stubTurnstileApi(page: Page): Promise<void> {
  await page.route("https://challenges.cloudflare.com/**", async (route) => {
    // Never fall through to the real provider, even if the integration adds
    // another script/frame endpoint. Only the known API is stubbed.
    if (
      route.request().url() !==
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    ) {
      await route.abort();
      throw new Error("Unexpected Turnstile provider request");
    }
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
  });
}

test.describe("Enabled Turnstile CSP", () => {
  test("loads the enabled Turnstile Script with the document nonce", async ({ page }) => {
    expect(process.env.TURNSTILE_SITE_KEY).toBe("e2e-dummy-site-key");
    expect(process.env.TURNSTILE_SECRET_KEY).toBe("e2e-dummy-secret-key");

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
