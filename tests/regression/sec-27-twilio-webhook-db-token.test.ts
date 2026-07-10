// SEC-27 — Twilio inbound webhook validated only against the env auth token.
//
// Bug (found 2026-07, security review): validateTwilioSignature in
// app/api/webhooks/twilio/route.ts read process.env.TWILIO_AUTH_TOKEN only. An
// operator who configured Twilio exclusively via the Admin Panel (token stored
// in SystemConfig, no env var) had every inbound SMS reply rejected with 403 —
// silently breaking reply-to-RSVP even though outbound SMS worked. The
// credential source of truth was also split between DB and env.
//
// Fix: resolve the token via the shared resolveTwilioAuthToken() (DB config
// first, then env). This test sets NO env token, configures the token only in
// the (mocked) DB config map, and asserts a correctly-signed request is accepted.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";

const { mockGetSystemConfigMap, mockInvitationFindMany } = vi.hoisted(() => ({
  mockGetSystemConfigMap: vi.fn(),
  mockInvitationFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    invitation: { findMany: mockInvitationFindMany },
    rSVP: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/config", () => ({
  isChannelEnabled: vi.fn().mockResolvedValue(true),
  getSystemConfigMap: mockGetSystemConfigMap,
}));

import { POST } from "@/app/api/webhooks/twilio/route";

const APP_URL = "http://localhost:3000";

function signedRequest(fields: Record<string, string>, token: string): NextRequest {
  const body = new URLSearchParams(fields).toString();
  const url = `${APP_URL}/api/webhooks/twilio`;
  const params = new URLSearchParams(body);
  const sortedKeys = [...params.keys()].sort();
  const canonical = sortedKeys.reduce((acc, key) => acc + key + (params.get(key) ?? ""), url);
  const signature = crypto.createHmac("sha1", token).update(canonical).digest("base64");
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "x-twilio-signature": signature,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
}

describe("SEC-27: Twilio webhook validates against the DB-configured token", () => {
  const origEnv = process.env.TWILIO_AUTH_TOKEN;
  const DB_TOKEN = "db-only-twilio-token";

  beforeEach(() => {
    mockGetSystemConfigMap.mockReset();
    mockInvitationFindMany.mockReset();
    // The whole point: NO env token — Twilio is configured only in the DB.
    delete process.env.TWILIO_AUTH_TOKEN;
    // Plaintext stored value → decryptConfig returns it unchanged (no colons).
    mockGetSystemConfigMap.mockResolvedValue({ twilio_auth_token: DB_TOKEN });
    mockInvitationFindMany.mockResolvedValue([]); // no pending invitations → 200 twiml
  });

  afterEach(() => {
    if (origEnv === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = origEnv;
  });

  it("accepts a request signed with the DB-configured token when no env token is set", async () => {
    const res = await POST(signedRequest({ From: "+15551234567", Body: "YES" }, DB_TOKEN));

    expect(res.status).toBe(200);
    expect(res.status).not.toBe(403);
    const xml = await res.text();
    expect(xml).toContain("No pending invitations");
  });

  it("still rejects a request signed with the wrong token", async () => {
    const res = await POST(signedRequest({ From: "+15551234567", Body: "YES" }, "wrong-token"));

    expect(res.status).toBe(403);
  });
});
