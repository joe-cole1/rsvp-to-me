import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const mutation = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: () => {
        mutation();
        throw new Error("GET must not access credentials");
      },
    }
  ),
}));
import { GET } from "@/app/auth/verify-cohost/route";
describe("GET /auth/verify-cohost", () => {
  it("navigates to explicit acceptance without issuing a session or using the invitation", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/auth/verify-cohost?token=invitation")
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/accept-cohost?token=invitation"
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mutation).not.toHaveBeenCalled();
  });
  it.each(["", "a".repeat(129)])("rejects missing or oversized tokens", async (token) => {
    const response = await GET(
      new NextRequest(`http://localhost:3000/auth/verify-cohost?token=${token}`)
    );
    expect(response.headers.get("location")).toContain("error=invalid-token");
  });
});
