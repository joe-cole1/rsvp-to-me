/* eslint-disable @typescript-eslint/no-require-imports */
// User flows shared by baseline scenarios and candidate checks. They use only
// long-standing action names and routes; version-specific calls stay in the
// scenario or candidate module that owns them.
const assert = require("node:assert/strict");
const { createClient, waitForMessage, lastMessageId, extractLink } = require("./action-client.cjs");
const { appRequire } = require("./common.cjs");

const APP_URL = "http://app:3000";

function isPhone(identifier) {
  return identifier.startsWith("+");
}

async function requestSignIn(client, identifier) {
  const kind = isPhone(identifier) ? "sms" : "emails";
  const since = await lastMessageId(kind);
  const sent = await client.action(
    "app/actions/auth.ts#sendMagicLinkAction",
    [identifier, undefined, null],
    { path: "/auth/sign-in" }
  );
  assert.equal(sent?.success, true, `sign-in request failed: ${JSON.stringify(sent)}`);
  return waitForMessage(
    kind,
    (message) => (kind === "sms" ? message.to === identifier : message.to.includes(identifier)),
    { since }
  );
}

async function assertSignedIn(client) {
  const dashboard = await client.get("/dashboard");
  assert.equal(dashboard.status, 200, `dashboard returned ${dashboard.status}`);
  assert.ok(!dashboard.url.startsWith("/auth/"), `dashboard redirected to ${dashboard.url}`);
}

/** Signs in with the emailed or texted link. Returns the client and delivery. */
async function signInByLink(identifier, label = identifier) {
  const client = createClient(APP_URL, label);
  const message = await requestSignIn(client, identifier);
  const verified = await client.get(extractLink(message.text, "/auth/verify"));
  assert.ok(!verified.url.includes("error="), `verification failed: ${verified.url}`);
  await assertSignedIn(client);
  return { client, message };
}

/** Signs in with the six-digit code from the same delivery (v2 sign-in codes). */
async function signInByCode(identifier, label = identifier) {
  const client = createClient(APP_URL, label);
  const message = await requestSignIn(client, identifier);
  const code = /\b(\d{6})\b/.exec(message.text)?.[1];
  assert.ok(code, "sign-in message contains no six-digit code");
  const verified = await client.action(
    "app/actions/auth.ts#verifySignInCodeAction",
    [identifier, code],
    { path: "/auth/sign-in" }
  );
  assert.equal(verified?.success, true, `code rejected: ${JSON.stringify(verified)}`);
  await assertSignedIn(client);
  return { client, message };
}

/** Uploads a generated PNG through the app's own upload route. */
async function uploadImage(client, background) {
  const sharp = appRequire("sharp");
  const png = await sharp({ create: { width: 48, height: 48, channels: 3, background } })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "rehearsal.png");
  const response = await client.request("/api/upload", {
    method: "POST",
    body: form,
    headers: { origin: APP_URL },
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `upload returned ${response.status}: ${JSON.stringify(body)}`);
  assert.match(body.url, /^\/api\/uploads\/[^/]+$/);
  return body.url;
}

async function assertImageServed(url) {
  const response = await fetch(new URL(url, APP_URL), { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, `${url} returned ${response.status}`);
  assert.match(response.headers.get("content-type") || "", /^image\//);
  await response.arrayBuffer();
}

async function assertHealthy() {
  const response = await fetch(`${APP_URL}/api/health`, {
    headers: { "x-health-token": process.env.HEALTH_CHECK_TOKEN },
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `health returned ${response.status}: ${JSON.stringify(body)}`);
  assert.equal(body.status, "ok", JSON.stringify(body));
  return `migrations ${body.migrations ?? "n/a"}`;
}

function futureDate(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

module.exports = {
  APP_URL,
  assertHealthy,
  assertImageServed,
  createClient,
  futureDate,
  signInByCode,
  signInByLink,
  uploadImage,
};
