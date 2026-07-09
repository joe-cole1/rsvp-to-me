import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock session
vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

import { getSession } from "@/lib/session";
import { POST } from "@/app/api/upload/route";

const mockGetSession = getSession as ReturnType<typeof vi.fn>;

function makeFormDataRequest(file: File | null): NextRequest {
  const formData = new FormData();
  if (file) formData.append("file", file);
  return new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it("returns 401 when no session", async () => {
    mockGetSession.mockResolvedValue(null);
    const req = makeFormDataRequest(new File(["data"], "test.jpg", { type: "image/jpeg" }));
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when role is GUEST", async () => {
    mockGetSession.mockResolvedValue({
      userId: "user1",
      email: "guest@example.com",
      role: "GUEST",
    });
    const req = makeFormDataRequest(new File(["data"], "photo.jpg", { type: "image/jpeg" }));
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file provided", async () => {
    mockGetSession.mockResolvedValue({ userId: "user1", email: "host@example.com", role: "HOST" });
    const req = makeFormDataRequest(null);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-image file", async () => {
    mockGetSession.mockResolvedValue({ userId: "user1", email: "host@example.com", role: "HOST" });
    const file = new File(["data"], "evil.exe", { type: "application/octet-stream" });
    const req = makeFormDataRequest(file);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Images only");
  });

  it("returns 400 for files over 8MB", async () => {
    mockGetSession.mockResolvedValue({ userId: "user1", email: "host@example.com", role: "HOST" });
    const big = new Uint8Array(9 * 1024 * 1024);
    const file = new File([big], "big.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 9 * 1024 * 1024 });
    const req = makeFormDataRequest(file);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/too large/i);
  });

  it("returns url on successful upload", async () => {
    mockGetSession.mockResolvedValue({ userId: "user1", email: "host@example.com", role: "HOST" });
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const file = new File([jpegBytes], "photo.jpg", { type: "image/jpeg" });
    const req = makeFormDataRequest(file);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toMatch(/^\/api\/uploads\/.+\.jpg$/);
  });
});
