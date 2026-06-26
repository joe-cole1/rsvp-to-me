import { execSync } from "child_process";
import { randomUUID, createHash } from "crypto";
import fs from "fs";
import path from "path";
import { sealData } from "iron-session";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../app/generated/prisma/client";

// Inline constants from lib/session.ts to avoid importing next/headers
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
  // Apply migrations
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env },
  });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // Seed host user + test event
    const host = await db.user.upsert({
      where: { email: E2E_HOST_EMAIL },
      update: {},
      create: { email: E2E_HOST_EMAIL, name: "E2E Test Host", role: "HOST" },
    });

    await db.event.upsert({
      where: { slug: E2E_EVENT_SLUG },
      update: { title: "E2E Test Event", status: "PUBLISHED", visibility: "PUBLIC" },
      create: {
        title: "E2E Test Event",
        slug: E2E_EVENT_SLUG,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        startAt: new Date("2030-12-01T20:00:00Z"),
        timezone: "America/New_York",
        locationType: "PHYSICAL",
        hostId: host.id,
      },
    });

    // Create a DB session for the host and seal it into a cookie
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL * 1000);

    await db.session.upsert({
      where: { id: sessionId },
      update: {},
      create: { id: sessionId, token: sessionId, userId: host.id, expiresAt },
    });

    const sealed = await sealData(
      { userId: host.id, email: host.email!, role: "HOST", sessionId },
      { password: getPassword(), ttl: SESSION_TTL }
    );

    // Write auth state for Playwright to consume
    fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
    fs.writeFileSync(
      AUTH_STATE_PATH,
      JSON.stringify({
        cookies: [
          {
            name: COOKIE_NAME,
            value: sealed,
            domain: "localhost",
            path: "/",
            expires: Math.floor(expiresAt.getTime() / 1000),
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        ],
        origins: [],
        _e2e: { hostId: host.id, hostEmail: E2E_HOST_EMAIL, eventSlug: E2E_EVENT_SLUG },
      })
    );

    // Seed a magic token for the auth flow test
    const rawToken = randomUUID();
    const hashed = hashToken(rawToken);
    await db.magicToken.deleteMany({ where: { userId: host.id, type: "LOGIN", used: false } });
    await db.magicToken.create({
      data: {
        userId: host.id,
        token: hashed,
        type: "LOGIN",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // Write the raw token so the auth flow test can construct the verify URL
    fs.writeFileSync(path.join(__dirname, "fixtures", "magic-token.txt"), rawToken);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}
