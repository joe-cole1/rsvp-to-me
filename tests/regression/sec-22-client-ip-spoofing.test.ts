// SEC-22 — Spoofable client IP defeated every IP-keyed rate limiter.
//
// Bug (found 2026-07, security review): `getClientIp` in lib/clientIp.ts trusted
// `cf-connecting-ip` / `x-real-ip` / `x-forwarded-for` even when
// `TRUSTED_IP_HEADER` was unset (the shipped default). Any client could send a
// random `X-Forwarded-For` on each request to mint a fresh rate-limit key,
// bypassing the magic-link, registration, event-password (SEC-19), and
// guest-invite (SEC-18) limiters. Worse, even on the trusted path the code took
// `split(",")[0]` — the FIRST (client-controlled) entry of an XFF chain — so a
// spoofed value could win over the proxy-appended real IP.
//
// Fix: only consult a forwarding header when the operator explicitly names it
// via `TRUSTED_IP_HEADER`, and take the LAST hop (the value the trusted proxy
// appended), not the first. With no trusted header configured, fall back to
// loopback rather than trusting spoofable headers.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockHeaders } = vi.hoisted(() => ({ mockHeaders: vi.fn() }));

vi.mock("next/headers", () => ({ headers: mockHeaders }));

import { getClientIp } from "@/lib/clientIp";

/** Build a minimal Headers-like object backed by a case-insensitive map. */
function headerBag(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => map.get(name.toLowerCase()) ?? null };
}

describe("SEC-22: client IP is not derived from spoofable headers", () => {
  const originalTrusted = process.env.TRUSTED_IP_HEADER;

  beforeEach(() => {
    mockHeaders.mockReset();
    delete process.env.TRUSTED_IP_HEADER;
  });

  afterEach(() => {
    if (originalTrusted === undefined) delete process.env.TRUSTED_IP_HEADER;
    else process.env.TRUSTED_IP_HEADER = originalTrusted;
  });

  it("ignores forwarding headers when TRUSTED_IP_HEADER is unset", async () => {
    mockHeaders.mockResolvedValue(
      headerBag({
        "x-forwarded-for": "6.6.6.6",
        "x-real-ip": "7.7.7.7",
        "cf-connecting-ip": "8.8.8.8",
      })
    );

    // A spoofed XFF must NOT become the rate-limit key.
    await expect(getClientIp()).resolves.toBe("127.0.0.1");
  });

  it("returns the LAST hop of the trusted header, not the client-spoofed first entry", async () => {
    process.env.TRUSTED_IP_HEADER = "x-forwarded-for";
    // Attacker prepends a fake IP; the trusted proxy appends the real client IP.
    mockHeaders.mockResolvedValue(headerBag({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }));

    await expect(getClientIp()).resolves.toBe("203.0.113.9");
  });

  it("handles a single-value trusted header (e.g. CF-Connecting-IP)", async () => {
    process.env.TRUSTED_IP_HEADER = "cf-connecting-ip";
    mockHeaders.mockResolvedValue(headerBag({ "cf-connecting-ip": "198.51.100.5" }));

    await expect(getClientIp()).resolves.toBe("198.51.100.5");
  });

  it("falls back to loopback when the trusted header is present but empty", async () => {
    process.env.TRUSTED_IP_HEADER = "x-forwarded-for";
    mockHeaders.mockResolvedValue(headerBag({ "x-forwarded-for": "  ,  " }));

    await expect(getClientIp()).resolves.toBe("127.0.0.1");
  });
});
