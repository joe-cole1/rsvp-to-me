// #877: demo seeding masked missing production initialization and blocked admin
// bootstrap. This browser runs against migrations only, with registration closed.
import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { createHash, randomBytes } from "node:crypto";
const email = "setup-owner@example.test";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

test("first administrator verifies email without seeds or host invites", async ({
  page,
  browser,
}) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    expect((await pool.query('SELECT COUNT(*)::int AS count FROM "User"')).rows[0].count).toBe(0);
    expect(
      (await pool.query('SELECT COUNT(*)::int AS count FROM "HostInviteCode"')).rows[0].count
    ).toBe(0);
    expect(
      (await pool.query('SELECT COUNT(*)::int AS count FROM "ThemePreset"')).rows[0].count
    ).toBeGreaterThan(0);
    await page.goto("/");
    await expect(page).toHaveURL(/\/setup$/);
    await page.getByLabel("Your name", { exact: true }).fill("First administrator");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await expect(page.getByLabel("Invite code", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Send setup link and code" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    expect(
      (await pool.query('SELECT role,name FROM "User" WHERE email=$1', [email])).rows[0]
    ).toEqual({ role: "GUEST", name: null });
    // Replace only this fixture's credential hashes. Never log delivered secrets.
    const raw = randomBytes(32).toString("hex");
    await pool.query(
      'UPDATE "MagicToken" SET token=$1,"codeHash"=$2 WHERE "userId"=(SELECT id FROM "User" WHERE email=$3)',
      [hash(raw), hash("012345"), email]
    );
    await page.getByLabel("6-digit code").fill("012345");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin(?:\?|$)/);
    expect(
      (await pool.query('SELECT role,name FROM "User" WHERE email=$1', [email])).rows[0]
    ).toEqual({ role: "ADMIN", name: "First administrator" });
    await page.goto("/setup");
    await expect(page).toHaveURL(/\/admin(?:\?|$)/);
    const visitor = await browser.newContext();
    try {
      const other = await visitor.newPage();
      await other.goto(`/auth/verify?token=${raw}`);
      await expect(other).toHaveURL(/invalid-token/);
      await other.goto("/setup");
      await expect(other).toHaveURL(/\/auth\/sign-in$/);
    } finally {
      await visitor.close();
    }
  } finally {
    await pool.end();
  }
});
