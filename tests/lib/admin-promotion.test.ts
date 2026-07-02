import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockUserCount: vi.fn(),
  mockUserUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      count: mocks.mockUserCount,
      update: mocks.mockUserUpdate,
    },
  },
}));

import { promoteInitialAdmin } from "@/lib/admin-promotion";

describe("promoteInitialAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INITIAL_ADMIN_EMAIL = "admin@example.com";
  });

  it("should return false if email is not provided", async () => {
    const result = await promoteInitialAdmin("user-1", null);
    expect(result).toBe(false);
    expect(mocks.mockUserCount).not.toHaveBeenCalled();
  });

  it("should return false if INITIAL_ADMIN_EMAIL is not set", async () => {
    delete process.env.INITIAL_ADMIN_EMAIL;
    const result = await promoteInitialAdmin("user-1", "admin@example.com");
    expect(result).toBe(false);
    expect(mocks.mockUserCount).not.toHaveBeenCalled();
  });

  it("should return false if email does not match INITIAL_ADMIN_EMAIL", async () => {
    const result = await promoteInitialAdmin("user-1", "other@example.com");
    expect(result).toBe(false);
    expect(mocks.mockUserCount).not.toHaveBeenCalled();
  });

  it("should promote user to ADMIN if email matches and adminCount is 0", async () => {
    mocks.mockUserCount.mockResolvedValue(0);
    mocks.mockUserUpdate.mockResolvedValue({});

    const result = await promoteInitialAdmin("user-1", "ADMIN@EXAMPLE.COM"); // Case-insensitivity check
    expect(result).toBe(true);
    expect(mocks.mockUserCount).toHaveBeenCalledWith({ where: { role: "ADMIN" } });
    expect(mocks.mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { role: "ADMIN" },
    });
  });

  it("should NOT promote user to ADMIN if email matches but admins already exist", async () => {
    mocks.mockUserCount.mockResolvedValue(1);

    const result = await promoteInitialAdmin("user-1", "admin@example.com");
    expect(result).toBe(false);
    expect(mocks.mockUserCount).toHaveBeenCalledWith({ where: { role: "ADMIN" } });
    expect(mocks.mockUserUpdate).not.toHaveBeenCalled();
  });
});
