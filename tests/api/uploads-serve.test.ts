import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  readFile: mockReadFile,
}));

import { GET } from "@/app/api/uploads/[filename]/route";

describe("GET /api/uploads/[filename]", () => {
  beforeEach(() => {
    mockReadFile.mockReset();
  });

  it("returns image with correct Content-Type for .jpg", async () => {
    mockReadFile.mockResolvedValue(Buffer.from("fake-image-data"));
    const req = new NextRequest("http://localhost:3000/api/uploads/test.jpg");
    const res = await GET(req, { params: Promise.resolve({ filename: "test.jpg" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toMatch(/immutable/);
  });

  it("returns image with correct Content-Type for .png", async () => {
    mockReadFile.mockResolvedValue(Buffer.from("png-data"));
    const req = new NextRequest("http://localhost:3000/api/uploads/photo.png");
    const res = await GET(req, { params: Promise.resolve({ filename: "photo.png" }) });
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("returns 404 when file does not exist", async () => {
    mockReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    const req = new NextRequest("http://localhost:3000/api/uploads/missing.jpg");
    const res = await GET(req, { params: Promise.resolve({ filename: "missing.jpg" }) });
    expect(res.status).toBe(404);
  });

  it("prevents path traversal attacks", async () => {
    mockReadFile.mockResolvedValue(Buffer.from("data"));
    const req = new NextRequest("http://localhost:3000/api/uploads/../../etc/passwd");
    await GET(req, { params: Promise.resolve({ filename: "../../etc/passwd" }) });
    const calledPath: string = mockReadFile.mock.calls[0][0];
    expect(calledPath).not.toContain("..");
    expect(calledPath).not.toContain("/etc/");
  });
});
