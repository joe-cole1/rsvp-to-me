import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// #825: GET /api/effects/search — the host editor's local icon search.

vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth-guards", () => ({ assertHostOrCohost: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));

import { getSession } from "@/lib/session";
import { assertHostOrCohost } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rateLimit";
import * as catalog from "@/lib/effect-catalog";
import { GET } from "@/app/api/effects/search/route";

const mockSession = vi.mocked(getSession);
const mockAssert = vi.mocked(assertHostOrCohost);
const mockRateLimit = vi.mocked(rateLimit);

function get(params: Record<string, string>) {
  const url = new URL("http://localhost:3000/api/effects/search");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return GET(new NextRequest(url));
}

const HOST = { userId: "host-1", email: "host@example.com", role: "HOST" as const };

describe("GET /api/effects/search", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSession.mockReset().mockResolvedValue(HOST as never);
    mockAssert.mockReset().mockResolvedValue({ id: "evt-1" } as never);
    mockRateLimit.mockReset().mockResolvedValue({
      success: true,
      limit: 120,
      remaining: 119,
      reset: new Date(Date.now() + 60_000),
    });
  });

  it("requires a session", async () => {
    mockSession.mockResolvedValue(null as never);
    const res = await get({ eventId: "evt-1", q: "cat" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(mockAssert).not.toHaveBeenCalled();
  });

  it("requires host, co-host or admin access to the event", async () => {
    mockAssert.mockRejectedValue(new Error("Forbidden"));
    const res = await get({ eventId: "evt-2", q: "cat" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(mockAssert).toHaveBeenCalledWith("evt-2");
  });

  // 01a1baab: the admin preset editor searches with eventId "admin".
  it("lets an admin search for the preset editor without an event", async () => {
    mockSession.mockResolvedValue({
      userId: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
    } as never);
    const res = await get({ eventId: "admin", q: "cake" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mockAssert).not.toHaveBeenCalled();
    expect(mockRateLimit).toHaveBeenCalledWith("effect-search:admin-1", 120, 60);
  });

  it("sends a non-admin's eventId=admin through the normal event guard", async () => {
    mockAssert.mockRejectedValue(new Error("Forbidden"));
    const res = await get({ eventId: "admin", q: "cake" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(mockAssert).toHaveBeenCalledWith("admin");
  });

  it("limits each signed-in user to 120 searches a minute, with retry timing", async () => {
    mockRateLimit.mockResolvedValue({
      success: false,
      limit: 120,
      remaining: 0,
      reset: new Date(Date.now() + 42_000),
    });
    const res = await get({ eventId: "evt-1", q: "cat" });
    expect(mockRateLimit).toHaveBeenCalledWith("effect-search:host-1", 120, 60);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
    expect(body.retryAfter).toBeGreaterThan(30);
    expect(body.retryAfter).toBeLessThanOrEqual(42);
    expect(res.headers.get("Retry-After")).toBe(String(body.retryAfter));
  });

  it("returns one private, uncached page of summaries", async () => {
    const res = await get({ eventId: "evt-1", q: "gato", locale: "es-ES", offset: "0" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["items", "nextOffset", "total"]);
    expect(body.items.length).toBeLessThanOrEqual(24);
    expect(body.items.map((i: { id: string }) => i.id)).toContain("noto:cat");
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/keywords|<svg|https?:\/\//);
  });

  it("returns no results for an empty query", async () => {
    const res = await get({ eventId: "evt-1", q: "   " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], total: 0, nextOffset: null });
  });

  it("accepts an unknown locale by falling back to English", async () => {
    const res = await get({ eventId: "evt-1", q: "cat", locale: "../../etc" });
    expect(res.status).toBe(200);
    expect((await res.json()).items[0].id).toBe("noto:cat");
  });

  it("rejects missing ids, oversized queries and bad offsets", async () => {
    for (const params of [
      { q: "cat" } as Record<string, string>,
      { eventId: "e".repeat(65), q: "cat" },
      { eventId: "evt-1", q: "x".repeat(81) },
      { eventId: "evt-1", q: "cat", offset: "-1" },
      { eventId: "evt-1", q: "cat", offset: "1.5" },
      { eventId: "evt-1", q: "cat", offset: "abc" },
      { eventId: "evt-1", q: "cat", offset: "999999" },
    ]) {
      const res = await get(params);
      expect(res.status, JSON.stringify(params)).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_request" });
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    }
  });

  it("allows an 80-character query", async () => {
    const res = await get({ eventId: "evt-1", q: "c".repeat(80) });
    expect(res.status).toBe(200);
  });

  it("hides internal errors behind a stable code", async () => {
    vi.spyOn(catalog, "searchLibraryIcons").mockRejectedValue(new Error("secret path /x/y"));
    const res = await get({ eventId: "evt-1", q: "cat" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "search_failed" });
  });
});
