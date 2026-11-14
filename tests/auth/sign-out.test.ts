import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDestroySession, mockRedirect } = vi.hoisted(() => ({
  mockDestroySession: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  destroySession: mockDestroySession,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { POST } from "@/app/auth/sign-out/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockRedirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

describe("POST /auth/sign-out", () => {
  it("calls destroySession and redirects to sign-in", async () => {
    await expect(
      POST(
        new NextRequest("http://localhost:3000/auth/sign-out", {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
        })
      )
    ).rejects.toThrow("REDIRECT:/auth/sign-in");
    expect(mockDestroySession).toHaveBeenCalled();
  });
});
