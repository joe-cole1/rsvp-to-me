import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: mockQueryRaw },
}));

import { GET } from "@/app/api/health/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRaw.mockResolvedValue([{ count: 0 }]);
});

describe("GET /api/health", () => {
  it("returns HTTP 200 when no pending migrations", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns status: 'ok' and migrations: 'ok' when healthy", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.migrations).toBe("ok");
  });

  it("returns a valid ISO timestamp when healthy", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("returns HTTP 503 when pending migrations exist", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 2 }]);
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("returns status: 'degraded' and migrations: 'pending' when migrations are stuck", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 1 }]);
    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.migrations).toBe("pending");
  });

  it("returns HTTP 503 when the migrations table is unreachable", async () => {
    mockQueryRaw.mockRejectedValue(new Error("connection refused"));
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("returns status: 'degraded' and migrations: 'unreachable' on DB error", async () => {
    mockQueryRaw.mockRejectedValue(new Error("connection refused"));
    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.migrations).toBe("unreachable");
  });
});
