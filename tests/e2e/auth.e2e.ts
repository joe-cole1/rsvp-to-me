import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readMagicToken } from "./fixtures";

test.describe("Auth flow", () => {
  // Verify test must run before sign-in test: createMagicLink invalidates all
  // existing tokens for a user, so submitting the sign-in form burns the seeded token.
  test("magic link creates a session that can be signed out", async ({ page }) => {
    const rawToken = readMagicToken();
    await page.goto(`/auth/verify?token=${rawToken}`);
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });
    await expect(page).toHaveURL(/dashboard/);

    expect((await page.request.get("/auth/sign-out")).status()).toBe(405);
    await page.getByRole("button", { name: "Open profile menu" }).click();
    await page.getByRole("menuitem", { name: /Sign Out/ }).click();
    await expect(page).toHaveURL(/\/auth\/sign-in/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test("invalid magic link is rejected without creating a session", async ({ page }) => {
    await page.goto("/auth/verify?token=not-a-valid-e2e-token");
    await expect(page).toHaveURL(/\/auth\/sign-in\?error=invalid-token/);
    await expect(page.getByText(/expired or already been used/i)).toBeVisible();
  });

  test("anonymous dashboard access redirects to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test("sign-in page renders and accepts email input", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await expect(page.getByText(/sign in with a magic link or code/i)).toBeVisible();
    await page.getByRole("textbox").fill("e2e-host@test.internal");
    await page.getByRole("button", { name: /send/i }).click();
    // Should show a "check your email/phone" confirmation state
    await expect(page.getByText(/check your/i)).toBeVisible({ timeout: 10_000 });
  });
});

// Replace only the submitted challenge's secrets with known test fixtures. The
// production app never logs credentials, and no test-only endpoint is needed.
test.describe("code sign-in (#844)", () => {
  const email = "e2e-code-signin@test.internal";
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  async function prepareUser() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await pool.query(
        `INSERT INTO "User" (id, email, role, "createdAt") VALUES ($1, $2, 'HOST', now()) ON CONFLICT (email) DO NOTHING`,
        [randomUUID(), email]
      );
    } finally {
      await pool.end();
    }
  }
  async function fixtureChallenge() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const raw = randomBytes(32).toString("hex");
    try {
      const result = await pool.query(
        `UPDATE "MagicToken" SET token = $1, "codeHash" = $2 WHERE id = (SELECT t.id FROM "MagicToken" t JOIN "User" u ON t."userId" = u.id WHERE u.email = $3 AND t.type = 'LOGIN' AND NOT t.used AND t."codeHash" IS NOT NULL ORDER BY t."createdAt" DESC LIMIT 1) RETURNING "expiresAt", "createdAt"`,
        [hash(raw), hash("012345"), email]
      );
      expect(result.rowCount).toBe(1);
      expect(
        result.rows[0].expiresAt.getTime() - result.rows[0].createdAt.getTime()
      ).toBeGreaterThan(14 * 60 * 1000);
      expect(
        result.rows[0].expiresAt.getTime() - result.rows[0].createdAt.getTime()
      ).toBeLessThanOrEqual(15 * 60 * 1000 + 1000);
      return raw;
    } finally {
      await pool.end();
    }
  }
  test("signs in with a code and invalidates its paired magic link", async ({ page }) => {
    await prepareUser();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/auth/sign-in");
    await page.getByRole("textbox").fill(email);
    await page.getByRole("button", { name: /send sign-in/i }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
    const raw = await fixtureChallenge();
    const submit = page.getByRole("button", { name: "Sign in", exact: true });
    await expect(submit).toBeDisabled();
    await page.getByLabel("6-digit code", { exact: true }).fill("012345");
    await submit.click();
    await expect(page).toHaveURL(/dashboard/);
    await page.getByRole("button", { name: "Open profile menu" }).click();
    await page.getByRole("menuitem", { name: /Sign Out/ }).click();
    await page.goto(`/auth/verify?token=${raw}`);
    await expect(page).toHaveURL(/error=invalid-token/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/auth\/sign-in/);
  });
  test("using the magic link invalidates code entry in the original browser", async ({
    page,
    browser,
  }) => {
    await prepareUser();
    await page.goto("/auth/sign-in");
    await page.getByRole("textbox").fill(email);
    await page.getByRole("button", { name: /send sign-in/i }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    const raw = await fixtureChallenge();
    const other = await browser.newContext();
    try {
      const otherPage = await other.newPage();
      await otherPage.goto(`${new URL(page.url()).origin}/auth/verify?token=${raw}`);
      await expect(otherPage).toHaveURL(/dashboard/);
      await page.getByLabel("6-digit code", { exact: true }).fill("012345");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(
        page.getByRole("alert").filter({ hasText: "Invalid or expired code" })
      ).toHaveText("Invalid or expired code. Check your code or request a new one.");
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/auth\/sign-in/);
    } finally {
      await other.close();
    }
  });
});

test("co-host invitation requires sign-in and explicit acceptance", async ({ page }) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const recipientId = randomUUID();
  const hostId = randomUUID();
  const eventId = randomUUID();
  const invitationId = randomUUID();
  const slug = `cohost-proof-${randomUUID()}`;
  const token = randomBytes(32).toString("hex");
  const login = randomBytes(32).toString("hex");
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  try {
    await pool.query(
      `INSERT INTO "User" (id, email, role, "createdAt") VALUES ($1, $2, 'HOST', now()), ($3, $4, 'GUEST', now())`,
      [hostId, `${hostId}@test.internal`, recipientId, `${recipientId}@test.internal`]
    );
    await pool.query(
      `INSERT INTO "Event" (id, slug, title, "hostId", "startAt", status, "createdAt", "updatedAt") VALUES ($1, $2, 'Co-host acceptance', $3, now() + interval '1 day', 'PUBLISHED', now(), now())`,
      [eventId, slug, hostId]
    );
    await pool.query(
      `INSERT INTO "CoHostInvitation" (id, "eventId", email, token, "expiresAt", "createdAt") VALUES ($1, $2, $3, $4, now() + interval '1 day', now())`,
      [invitationId, eventId, `${recipientId}@test.internal`, hash(token)]
    );
    await pool.query(
      `INSERT INTO "MagicToken" (id, "userId", token, type, "expiresAt", "createdAt") VALUES ($1, $2, $3, 'LOGIN', now() + interval '15 minutes', now())`,
      [randomUUID(), recipientId, hash(login)]
    );
    await page.goto(`/auth/verify-cohost?token=${token}`);
    await expect(page).toHaveURL(/auth\/sign-in\?redirect=/);
    expect(
      (await pool.query('SELECT id FROM "EventCoHost" WHERE "eventId" = $1', [eventId])).rowCount
    ).toBe(0);
    expect(
      (await pool.query('SELECT id FROM "Session" WHERE "userId" = $1', [recipientId])).rowCount
    ).toBe(0);
    const destination = `/auth/accept-cohost?token=${token}`;
    await page.goto(`/auth/verify?token=${login}&redirect=${encodeURIComponent(destination)}`);
    await expect(page.getByRole("button", { name: "Accept invitation" })).toBeVisible();
    expect(
      (await pool.query('SELECT id FROM "EventCoHost" WHERE "eventId" = $1', [eventId])).rowCount
    ).toBe(0);
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page).toHaveURL(new RegExp(`/e/${slug}/settings`));
    expect(
      (await pool.query('SELECT "userId" FROM "EventCoHost" WHERE "eventId" = $1', [eventId])).rows
    ).toEqual([{ userId: recipientId }]);
    expect(
      (await pool.query('SELECT id FROM "CoHostInvitation" WHERE id = $1', [invitationId])).rowCount
    ).toBe(0);
  } finally {
    await pool.query('DELETE FROM "Event" WHERE id = $1', [eventId]);
    await pool.query('DELETE FROM "User" WHERE id IN ($1, $2)', [hostId, recipientId]);
    await pool.end();
  }
});
