// SEC-11 — XML injection in the Twilio SMS-reply webhook.
//
// Bug (found 2026-06, security review): `twiml()` in
// app/api/webhooks/twilio/route.ts interpolated user-controlled strings
// (the event title, guest names) directly into a raw XML template without
// escaping. An event titled `</Message><Message>injected` would break out of
// the <Message> element and inject arbitrary TwiML into the Twilio response.
//
// Fix: escape XML metacharacters (& < > " ') before interpolating into the
// <Message> body. This test drives the real POST handler with a malicious
// event title and asserts the response cannot be broken out of.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";

const { mockInvitationFindMany, mockRsvpFindUnique, mockRsvpCount, mockRsvpUpdate } = vi.hoisted(
  () => ({
    mockInvitationFindMany: vi.fn(),
    mockRsvpFindUnique: vi.fn(),
    mockRsvpCount: vi.fn(),
    mockRsvpUpdate: vi.fn(),
  })
);

vi.mock("@/lib/db", () => ({
  db: {
    invitation: { findMany: mockInvitationFindMany },
    rSVP: {
      findUnique: mockRsvpFindUnique,
      count: mockRsvpCount,
      update: mockRsvpUpdate,
    },
  },
}));

import { POST } from "@/app/api/webhooks/twilio/route";

const APP_URL = "http://localhost:3000";
const AUTH_TOKEN = "test-twilio-auth-token";

function signedRequest(fields: Record<string, string>): NextRequest {
  const body = new URLSearchParams(fields).toString();
  const url = `${APP_URL}/api/webhooks/twilio`;
  const params = new URLSearchParams(body);
  const sortedKeys = [...params.keys()].sort();
  const canonical = sortedKeys.reduce((acc, key) => acc + key + (params.get(key) ?? ""), url);
  const signature = crypto.createHmac("sha1", AUTH_TOKEN).update(canonical).digest("base64");

  return new NextRequest(url, {
    method: "POST",
    headers: {
      "x-twilio-signature": signature,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
}

describe("SEC-11: Twilio webhook XML injection", () => {
  beforeEach(() => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    mockInvitationFindMany.mockReset();
    mockRsvpFindUnique.mockReset();
    mockRsvpCount.mockReset();
    mockRsvpUpdate.mockReset();
  });

  it("escapes a malicious event title instead of letting it break out of <Message>", async () => {
    const evilTitle = `Party</Message><Message>INJECTED`;
    mockInvitationFindMany.mockResolvedValue([
      {
        rsvpId: "rsvp1",
        event: {
          title: evilTitle,
          slug: "party",
          rsvpDeadline: null,
          maybeEnabled: true,
          capacity: null,
        },
      },
    ]);
    mockRsvpFindUnique.mockResolvedValue({ editToken: "tok1", status: "INVITED" });
    mockRsvpUpdate.mockResolvedValue({});

    const res = await POST(signedRequest({ From: "+15551234567", Body: "YES" }));
    const xml = await res.text();

    // The injected closing tag must NOT appear literally — it would forge a TwiML element.
    expect(xml).not.toContain("</Message><Message>INJECTED");
    // It must appear escaped instead.
    expect(xml).toContain("&lt;/Message&gt;&lt;Message&gt;INJECTED");
    // Exactly one real <Message> element in the response.
    expect(xml.match(/<Message>/g)?.length).toBe(1);
  });
});
