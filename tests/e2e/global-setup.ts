import { execSync } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

const E2E_HOST_EMAIL = "e2e-host@test.internal";
const E2E_EVENT_SLUG = "e2e-test-event";
const AUTH_STATE_PATH = path.join(__dirname, "fixtures", "auth-state.json");

export default async function globalSetup() {
  // Apply migrations
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env },
  });

  // Import after migrations so the Prisma client uses the correct schema
  const { db } = await import("@/lib/db");
  const { sealSession, COOKIE_NAME, SESSION_TTL } = await import("@/lib/session");
  const { hashToken } = await import("@/lib/hash");

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

  const sealed = await sealSession({
    userId: host.id,
    email: host.email!,
    role: "HOST",
    sessionId,
  });

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
      // Store host info for tests to use
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
}
