import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

// No mocks — this test hits the real DB and checks actual migration state

describe("GET /api/health — real DB integration", () => {
  it("returns 200 with status:ok when migrations are applied", async () => {
    const res = await GET();
    const body = await res.json();

    // Migrations were applied by global-setup before this test runs
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.migrations).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });
});
