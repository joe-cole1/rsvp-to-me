import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: mockQueryRaw },
}));

import { GET } from "@/app/api/health/route";

const TOKEN = "test-health-token-value";

function anonRequest() {
  return new Request("http://localhost:3000/api/health");
}

function internalRequest(token = TOKEN) {
  return new Request("http://localhost:3000/api/health", {
    headers: { "x-health-token": token },
  });
}

const originalToken = process.env.HEALTH_CHECK_TOKEN;

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRaw.mockResolvedValue([{ count: 0 }]);
  process.env.HEALTH_CHECK_TOKEN = TOKEN;
});

afterEach(() => {
  if (originalToken === undefined) delete process.env.HEALTH_CHECK_TOKEN;
  else process.env.HEALTH_CHECK_TOKEN = originalToken;
});

describe("GET /api/health — anonymous callers (SEC-31 minimal contract)", () => {
  it("returns HTTP 200 when no pending migrations", async () => {
    const res = await GET(anonRequest());
    expect(res.status).toBe(200);
  });

  it("returns only { status: 'ok' } when healthy — no internal detail", async () => {
    const res = await GET(anonRequest());
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("returns HTTP 503 when pending migrations exist", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 2 }]);
    const res = await GET(anonRequest());
    expect(res.status).toBe(503);
  });

  it("returns only { status: 'unavailable' } on pending migrations — no migration state", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 1 }]);
    const res = await GET(anonRequest());
    const body = await res.json();
    expect(body).toEqual({ status: "unavailable" });
  });

  it("returns HTTP 503 and no detail when the migrations table is unreachable", async () => {
    mockQueryRaw.mockRejectedValue(new Error("connection refused"));
    const res = await GET(anonRequest());
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toEqual({ status: "unavailable" });
  });

  it("treats a wrong token as anonymous", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 1 }]);
    const res = await GET(internalRequest("wrong-token"));
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toEqual({ status: "unavailable" });
  });

  it("treats every caller as anonymous when HEALTH_CHECK_TOKEN is unset", async () => {
    delete process.env.HEALTH_CHECK_TOKEN;
    mockQueryRaw.mockResolvedValue([{ count: 1 }]);
    const res = await GET(internalRequest(""));
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toEqual({ status: "unavailable" });
  });
});

describe("GET /api/health — internal callers with HEALTH_CHECK_TOKEN", () => {
  it("returns the detailed healthy body with a valid ISO timestamp", async () => {
    const res = await GET(internalRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.migrations).toBe("ok");
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("returns status 'degraded' and migrations 'pending' when migrations are stuck", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 1 }]);
    const res = await GET(internalRequest());
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.migrations).toBe("pending");
  });

  it("returns status 'degraded' and migrations 'unreachable' on DB error", async () => {
    mockQueryRaw.mockRejectedValue(new Error("connection refused"));
    const res = await GET(internalRequest());
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.migrations).toBe("unreachable");
  });
});
