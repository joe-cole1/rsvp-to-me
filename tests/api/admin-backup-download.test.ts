import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/admin/backups/[filename]/route";
import { Readable } from "stream";

const { mockGetSession, mockExistsSync, mockCreateReadStream, mockStatSync } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockExistsSync: vi.fn(),
  mockCreateReadStream: vi.fn(),
  mockStatSync: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mockGetSession,
}));

vi.mock("fs", () => ({
  default: {
    existsSync: mockExistsSync,
    createReadStream: mockCreateReadStream,
    statSync: mockStatSync,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/backups/[filename]", () => {
  it("returns 403 when no session is present", async () => {
    mockGetSession.mockResolvedValue(null);
    const req = new Request("http://localhost/api/admin/backups/db.sql");
    const params = Promise.resolve({ filename: "db.sql" });

    const res = await GET(req, { params });
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("Administrator access required");
  });

  it("returns 403 when session role is HOST (not admin)", async () => {
    mockGetSession.mockResolvedValue({ userId: "u-1", role: "HOST", email: "host@example.com" });
    const req = new Request("http://localhost/api/admin/backups/db.sql");
    const params = Promise.resolve({ filename: "db.sql" });

    const res = await GET(req, { params });
    expect(res.status).toBe(403);
  });

  it("returns 404 when file does not exist", async () => {
    mockGetSession.mockResolvedValue({ userId: "u-1", role: "ADMIN", email: "admin@example.com" });
    mockExistsSync.mockReturnValue(false);
    const req = new Request("http://localhost/api/admin/backups/db.sql");
    const params = Promise.resolve({ filename: "db.sql" });

    const res = await GET(req, { params });
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("Backup file not found");
  });

  it("returns file contents with Content-Disposition: attachment for valid admin request", async () => {
    mockGetSession.mockResolvedValue({ userId: "u-1", role: "ADMIN", email: "admin@example.com" });
    mockExistsSync.mockReturnValue(true);

    const stream = Readable.from(["file-content-chunk"]);
    mockCreateReadStream.mockReturnValue(stream);
    mockStatSync.mockReturnValue({ size: 18 });

    const req = new Request("http://localhost/api/admin/backups/db.sql");
    const params = Promise.resolve({ filename: "db.sql" });

    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="db.sql"');
    expect(res.headers.get("Content-Length")).toBe("18");
  });
});
