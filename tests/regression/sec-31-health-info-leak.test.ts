// SEC-31 / M-8 — Health endpoint leaked migration/DB state to anonymous callers.
//
// Bug (found 2026-07, security review): GET /api/health returned
// `{status:"degraded", migrations:"pending"|"unreachable"}` to anyone, plus a
// timestamp on the healthy path. That told unauthenticated observers when a
// deploy/migration was in flight or the DB was down — useful for timing
// attacks against deploys and for fingerprinting outages.
//
// Fix: anonymous callers now get a minimal liveness signal only — 200
// `{status:"ok"}` or 503 `{status:"unavailable"}` with no further fields. The
// detailed body is gated behind the operator-configured HEALTH_CHECK_TOKEN
// presented in the `x-health-token` header (timing-safe comparison); with the
// env var unset every caller is anonymous.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: mockQueryRaw },
}));

import { GET } from "@/app/api/health/route";

const TOKEN = "sec-31-regression-token";
const originalToken = process.env.HEALTH_CHECK_TOKEN;

function request(headers?: Record<string, string>) {
  return new Request("http://localhost:3000/api/health", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.HEALTH_CHECK_TOKEN = TOKEN;
});

afterEach(() => {
  if (originalToken === undefined) delete process.env.HEALTH_CHECK_TOKEN;
  else process.env.HEALTH_CHECK_TOKEN = originalToken;
});

describe("SEC-31: /api/health does not leak internal state to anonymous callers", () => {
  it("never exposes 'migrations' to an anonymous caller when migrations are pending", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 3 }]);
    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.migrations).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("pending");
  });

  it("never exposes 'migrations' to an anonymous caller when the DB is unreachable", async () => {
    mockQueryRaw.mockRejectedValue(new Error("connection refused"));
    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.migrations).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("unreachable");
  });

  it("does not expose a timestamp to an anonymous caller on the healthy path", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 0 }]);
    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });

  it("rejects a wrong token — same minimal body as anonymous", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 1 }]);
    const res = await GET(request({ "x-health-token": "not-the-token" }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toEqual({ status: "unavailable" });
  });

  it("still preserves the liveness signal (200 healthy / 503 degraded) for anonymous probes", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 0 }]);
    expect((await GET(request())).status).toBe(200);

    mockQueryRaw.mockResolvedValue([{ count: 1 }]);
    expect((await GET(request())).status).toBe(503);
  });

  it("returns the detailed migration state only with the correct token", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 1 }]);
    const res = await GET(request({ "x-health-token": TOKEN }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.migrations).toBe("pending");
  });

  it("treats everyone as anonymous when HEALTH_CHECK_TOKEN is not configured", async () => {
    delete process.env.HEALTH_CHECK_TOKEN;
    mockQueryRaw.mockRejectedValue(new Error("down"));
    const res = await GET(request({ "x-health-token": "" }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toEqual({ status: "unavailable" });
  });
});
