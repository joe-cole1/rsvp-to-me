import { execSync } from "child_process";
import { randomUUID, createHash } from "crypto";
import fs from "fs";
import path from "path";
import { sealData } from "iron-session";
import { Pool } from "pg";

// Inline constants to avoid importing lib/session.ts (which imports next/headers)
const COOKIE_NAME = "rsvp-session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

const E2E_HOST_EMAIL = "e2e-host@test.internal";
const E2E_EVENT_SLUG = "e2e-test-event";
const AUTH_STATE_PATH = path.join(__dirname, "fixtures", "auth-state.json");

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

export default async function globalSetup() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env },
  });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // 1. Clean up any stale E2E test data first to guarantee clean slate
    await pool.query(
      `DELETE FROM "RSVP" WHERE "eventId" IN (SELECT id FROM "Event" WHERE slug = $1)`,
      [E2E_EVENT_SLUG]
    );
    await pool.query(
      `DELETE FROM "Comment" WHERE "eventId" IN (SELECT id FROM "Event" WHERE slug = $1)`,
      [E2E_EVENT_SLUG]
    );
    await pool.query(`DELETE FROM "Event" WHERE slug = $1`, [E2E_EVENT_SLUG]);
    await pool.query(`DELETE FROM "User" WHERE email = $1`, [E2E_HOST_EMAIL]);

    // 2. Upsert host user
    const userRes = await pool.query<{ id: string }>(
      `INSERT INTO "User" (id, email, name, role, "createdAt")
       VALUES ($1, $2, 'E2E Test Host', 'HOST'::"Role", now())
       ON CONFLICT (email) DO UPDATE SET role = 'HOST'::"Role"
       RETURNING id`,
      [randomUUID(), E2E_HOST_EMAIL]
    );
    const hostId = userRes.rows[0].id;

    // 3. Upsert test event
    const eventId = randomUUID();
    await pool.query(
      `INSERT INTO "Event" (id, slug, title, status, visibility, "startAt", timezone, "locationType", "hostId", "createdAt", "updatedAt")
       VALUES ($1, $2, 'E2E Test Event', 'PUBLISHED'::"EventStatus", 'PUBLIC'::"Visibility", '2030-12-01T20:00:00Z', 'America/New_York', 'PHYSICAL'::"LocationType", $3, now(), now())
       ON CONFLICT (slug) DO UPDATE SET title = 'E2E Test Event', status = 'PUBLISHED'::"EventStatus", visibility = 'PUBLIC'::"Visibility"`,
      [eventId, E2E_EVENT_SLUG, hostId]
    );

    // 4. Create a DB session and seal it into a cookie
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL * 1000);
    await pool.query(
      `INSERT INTO "Session" (id, token, "userId", "expiresAt", "createdAt")
       VALUES ($1, $1, $2, $3, now())
       ON CONFLICT (id) DO NOTHING`,
      [sessionId, hostId, expiresAt]
    );

    const sealed = await sealData(
      { userId: hostId, email: E2E_HOST_EMAIL, role: "HOST", sessionId },
      { password: getPassword(), ttl: SESSION_TTL }
    );

    const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
    const cookieDomain = new URL(baseUrl).hostname;

    fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
    fs.writeFileSync(
      AUTH_STATE_PATH,
      JSON.stringify({
        cookies: [
          {
            name: COOKIE_NAME,
            value: sealed,
            domain: cookieDomain,
            path: "/",
            expires: Math.floor(expiresAt.getTime() / 1000),
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        ],
        origins: [],
        _e2e: { hostId, hostEmail: E2E_HOST_EMAIL, eventSlug: E2E_EVENT_SLUG },
      })
    );

    // Seed a magic token for the auth flow test
    const rawToken = randomUUID();
    const hashed = hashToken(rawToken);
    await pool.query(
      `DELETE FROM "MagicToken" WHERE "userId" = $1 AND type = 'LOGIN'::"MagicTokenType" AND used = false`,
      [hostId]
    );
    await pool.query(
      `INSERT INTO "MagicToken" (id, "userId", token, "expiresAt", "createdAt", used, type)
       VALUES ($1, $2, $3, $4, now(), false, 'LOGIN'::"MagicTokenType")`,
      [randomUUID(), hostId, hashed, new Date(Date.now() + 15 * 60 * 1000)]
    );

    fs.writeFileSync(path.join(__dirname, "fixtures", "magic-token.txt"), rawToken);
  } finally {
    await pool.end();
  }
}
