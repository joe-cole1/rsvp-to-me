import { test, expect, type Page } from "@playwright/test";
import { EFFECTS_EVENT_SLUG, LEGACY_EFFECT_EVENT_SLUG, readAuthCookies } from "./fixtures";

// #825: a host mixes local library icons, sets Amount / Size / Speed / Movement
// independently, changes the font, reloads, and sees the same background on
// the event page, guest list and RSVP flow — all served from this origin.

const CAT = "/effects/library/noto/1.2.10/cat.svg";
const HEART = "/effects/library/noto/1.2.10/red-heart.svg";

// Theme saves are server actions (POSTs). Count the ones in flight so a test
// never reloads while a queued save is still running: the page's "Saving"
// line clears when any one save finishes, and "networkidle" has already been
// reached by the time the host starts clicking, so neither is a reliable wait.
const inFlightSaves = new WeakMap<Page, { count: number }>();

function trackSaves(page: Page) {
  const state = { count: 0 };
  inFlightSaves.set(page, state);
  page.on("request", (r) => {
    if (r.method() === "POST") state.count++;
  });
  const finished = (r: { method(): string }) => {
    if (r.method() === "POST") state.count--;
  };
  page.on("requestfinished", finished);
  page.on("requestfailed", finished);
}

async function openEffects(page: Page, slug: string) {
  if (!inFlightSaves.has(page)) trackSaves(page);
  await page.goto(`/e/${slug}/settings?section=theme`);
  await page.getByRole("button", { name: "Effects", exact: true }).click();
}

function group(page: Page, name: string) {
  return page.getByRole("group", { name, exact: true });
}

async function settle(page: Page) {
  const saves = inFlightSaves.get(page)!;
  // Twice, with a pause between, so a save started by the last click is counted too.
  for (let i = 0; i < 2; i++) {
    await expect.poll(() => saves.count, { timeout: 15_000 }).toBe(0);
    await page.waitForTimeout(500);
  }
  await expect.poll(() => saves.count).toBe(0);
}

test.describe("Background effects (#825)", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies(readAuthCookies());
  });

  test("host builds a library mixture that survives reload on every event page", async ({
    page,
    baseURL,
  }) => {
    const appHost = new URL(baseURL!).host;
    const foreign: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol.startsWith("http") && url.host !== appHost) foreign.push(url.href);
    });

    await openEffects(page, EFFECTS_EVENT_SLUG);
    const search = page.getByLabel("Search icons");

    // Spanish and German searches with the interface in English
    await search.fill("gato");
    await page.locator('[data-icon-id="noto:cat"]').click();
    // "Herz" alone matches hundreds of hearts; the full German label ranks red heart first.
    await search.fill("Rotes Herz");
    await page.locator('[data-icon-id="noto:red-heart"]').click();
    await expect(page.getByRole("button", { name: "Remove Cat" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Red heart" })).toBeVisible();

    // Independent controls
    await group(page, "Amount").getByRole("button", { name: "More" }).click();
    await group(page, "Speed").getByRole("button", { name: "Lively" }).click();
    await group(page, "Movement").getByRole("button", { name: "Up" }).click();
    // Keyboard-only size: Small (3×) plus two steps, then leave the slider
    const slider = page.getByRole("slider", { name: "Exact size" });
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Tab");
    await expect(group(page, "Size").locator("output")).toHaveText("4×");

    // A font change must not drop the mixture
    await page.getByRole("button", { name: "Font", exact: true }).click();
    await page.getByRole("button", { name: /Playfair Display/ }).click();
    await settle(page);

    await page.reload();
    await page.getByRole("button", { name: "Effects", exact: true }).click();
    await expect(page.getByRole("button", { name: "Remove Cat" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Red heart" })).toBeVisible();
    await expect(group(page, "Amount").getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(group(page, "Size").locator("output")).toHaveText("4×");
    await expect(group(page, "Speed").getByRole("button", { name: "Lively" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(group(page, "Movement").getByRole("button", { name: "Up" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    for (const path of [
      `/e/${EFFECTS_EVENT_SLUG}`,
      `/e/${EFFECTS_EVENT_SLUG}/guests`,
      `/e/${EFFECTS_EVENT_SLUG}/rsvp?status=going`,
    ]) {
      await page.goto(path);
      expect(new URL(page.url()).pathname + new URL(page.url()).search, path).toBe(path);
      const layer = page.locator(".rsvp-effect-layer");
      await expect(layer, path).toHaveAttribute("data-effect-id", "custom");
      await expect(layer).toHaveAttribute("data-effect-movement", "up");
      await expect(layer).toHaveAttribute("aria-hidden", "true");
      const sprites = await layer
        .locator("img")
        .evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src")));
      expect(sprites, path).toHaveLength(28);
      expect(new Set(sprites)).toEqual(new Set([CAT, HEART]));
    }

    // The library art itself is served locally with a long-lived cache rule
    const svg = await page.request.get(CAT);
    expect(svg.status()).toBe(200);
    expect(svg.headers()["content-type"]).toContain("image/svg+xml");
    expect(svg.headers()["cache-control"]).toContain("immutable");

    expect(foreign, "no request may leave the app's origin").toEqual([]);
  });

  test("an older 6× effect keeps its size through load and an Amount change", async ({ page }) => {
    await openEffects(page, LEGACY_EFFECT_EVENT_SLUG);
    const size = group(page, "Size");
    await expect(size.locator("output")).toHaveText("6×");
    for (const name of ["Small", "Medium", "Large"]) {
      await expect(size.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
    // Snow keeps falling until the host picks a movement
    await expect(group(page, "Movement").getByRole("button", { name: "Down" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await group(page, "Amount").getByRole("button", { name: "Less" }).click();
    await settle(page);

    await page.reload();
    await page.getByRole("button", { name: "Effects", exact: true }).click();
    await expect(group(page, "Size").locator("output")).toHaveText("6×");
    await expect(group(page, "Amount").getByRole("button", { name: "Less" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.goto(`/e/${LEGACY_EFFECT_EVENT_SLUG}`);
    const layer = page.locator(".rsvp-effect-layer");
    await expect(layer).toHaveAttribute("data-effect-id", "snow");
    await expect(layer).toHaveAttribute("data-effect-movement", "down");
    await expect(layer.locator("img")).toHaveCount(10);
  });
});
