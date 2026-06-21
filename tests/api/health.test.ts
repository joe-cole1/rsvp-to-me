import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns HTTP 200 status", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns JSON body with status: 'ok'", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("returns JSON body with a valid ISO timestamp string in 'timestamp' field", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
