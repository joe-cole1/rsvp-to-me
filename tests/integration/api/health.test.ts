import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET } from "@/app/api/health/route";

// No mocks — this test hits the real DB and checks actual migration state
// (CRIT-3). Since SEC-31 the detailed body requires the HEALTH_CHECK_TOKEN,
// so the migration-state assertions authenticate via the x-health-token header.

const TOKEN = "integration-health-token";
const originalToken = process.env.HEALTH_CHECK_TOKEN;

beforeAll(() => {
  process.env.HEALTH_CHECK_TOKEN = TOKEN;
});

afterAll(() => {
  if (originalToken === undefined) delete process.env.HEALTH_CHECK_TOKEN;
  else process.env.HEALTH_CHECK_TOKEN = originalToken;
});

describe("GET /api/health — real DB integration", () => {
  it("returns 200 with the minimal body for anonymous callers", async () => {
    const res = await GET(new Request("http://localhost:3000/api/health"));
    const body = await res.json();

    // Migrations were applied by global-setup before this test runs
    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });

  it("returns migrations:ok detail for internal callers when migrations are applied", async () => {
    const res = await GET(
      new Request("http://localhost:3000/api/health", {
        headers: { "x-health-token": TOKEN },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.migrations).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });
});
