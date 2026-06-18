import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockUserCount,
  mockEventCount,
  mockRsvpCount,
  mockCheckInCount,
  mockHostInviteCodeCount,
  mockUserFindMany,
  mockUserUpdate,
  mockUserDelete,
  mockEventFindMany,
  mockEventDelete,
  mockHostInviteCodeFindMany,
  mockHostInviteCodeCreate,
  mockHostInviteCodeDelete,
  mockHostInviteCodeFindUnique,
  mockSystemConfigFindMany,
  mockSystemConfigUpsert,
  mockGetSession,
} = vi.hoisted(() => ({
  mockUserCount: vi.fn(),
  mockEventCount: vi.fn(),
  mockRsvpCount: vi.fn(),
  mockCheckInCount: vi.fn(),
  mockHostInviteCodeCount: vi.fn(),
  mockUserFindMany: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockUserDelete: vi.fn(),
  mockEventFindMany: vi.fn(),
  mockEventDelete: vi.fn(),
  mockHostInviteCodeFindMany: vi.fn(),
  mockHostInviteCodeCreate: vi.fn(),
  mockHostInviteCodeDelete: vi.fn(),
  mockHostInviteCodeFindUnique: vi.fn(),
  mockSystemConfigFindMany: vi.fn(),
  mockSystemConfigUpsert: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      count: mockUserCount,
      findMany: mockUserFindMany,
      update: mockUserUpdate,
      delete: mockUserDelete,
    },
    event: {
      count: mockEventCount,
      findMany: mockEventFindMany,
      delete: mockEventDelete,
    },
    rSVP: {
      count: mockRsvpCount,
    },
    checkIn: {
      count: mockCheckInCount,
    },
    hostInviteCode: {
      count: mockHostInviteCodeCount,
      findMany: mockHostInviteCodeFindMany,
      create: mockHostInviteCodeCreate,
      delete: mockHostInviteCodeDelete,
      findUnique: mockHostInviteCodeFindUnique,
    },
    eventCoHost: {
      deleteMany: vi.fn(),
    },
    systemConfig: {
      findMany: mockSystemConfigFindMany,
      upsert: mockSystemConfigUpsert,
    },
  },
}));

vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  getAdminStats,
  getAdminUsers,
  updateUserRole,
  deleteUserAccount,
  getAdminEvents,
  deleteEventAdmin,
  getInviteCodes,
  createInviteCode,
  revokeInviteCode,
  getSystemConfig,
  updateSystemConfig,
} from "@/app/actions/admin";

describe("app/actions/admin.ts", () => {
  const ADMIN_ID = "admin-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authorization check", () => {
    it("throws error if user is not an admin", async () => {
      mockGetSession.mockResolvedValue({ userId: "user-1", email: "u@example.com", role: "HOST" });
      await expect(getAdminStats()).rejects.toThrow("Forbidden: Admin access required");
    });
  });

  describe("Admin operations (Authorized)", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({ userId: ADMIN_ID, email: "admin@example.com", role: "ADMIN" });
    });

    it("fetches system statistics", async () => {
      mockUserCount.mockResolvedValue(10);
      mockEventCount.mockResolvedValue(5);
      mockRsvpCount.mockResolvedValue(30);
      mockCheckInCount.mockResolvedValue(12);
      mockHostInviteCodeCount.mockResolvedValue(2);

      const stats = await getAdminStats();

      expect(stats.totalUsers).toBe(10);
      expect(stats.totalEvents).toBe(5);
      expect(stats.totalRsvps).toBe(30);
      expect(stats.totalCheckIns).toBe(12);
      expect(stats.totalInviteCodes).toBe(2);
    });

    it("lists all system users", async () => {
      const mockUsers = [{ id: "u-1", name: "Joe", email: "joe@example.com", role: "HOST" }];
      mockUserFindMany.mockResolvedValue(mockUsers);

      const users = await getAdminUsers();
      expect(users).toEqual(mockUsers);
      expect(mockUserFindMany).toHaveBeenCalled();
    });

    it("updates user role", async () => {
      mockUserUpdate.mockResolvedValue({ id: "u-1", role: "ADMIN" });
      const res = await updateUserRole("u-1", "ADMIN");
      expect(res.success).toBe(true);
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u-1" },
          data: { role: "ADMIN" },
        })
      );
    });

    it("prevents changing own admin role", async () => {
      await expect(updateUserRole(ADMIN_ID, "HOST")).rejects.toThrow("You cannot change your own admin role.");
    });

    it("deletes user account", async () => {
      mockEventFindMany.mockResolvedValue([]);
      mockUserDelete.mockResolvedValue({ id: "u-1" });

      const res = await deleteUserAccount("u-1");
      expect(res.success).toBe(true);
      expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: "u-1" } });
    });

    it("lists events", async () => {
      mockEventFindMany.mockResolvedValue([
        {
          id: "e-1",
          title: "BBQ",
          slug: "bbq",
          startAt: new Date(),
          status: "PUBLISHED",
          visibility: "PUBLIC",
          host: { name: "Joe", email: "joe@example.com" },
          _count: { rsvps: 5 },
        },
      ]);

      const events = await getAdminEvents();
      expect(events[0].title).toBe("BBQ");
      expect(events[0].rsvpCount).toBe(5);
    });

    it("deletes event via admin moderation", async () => {
      mockEventDelete.mockResolvedValue({ id: "e-1" });
      const res = await deleteEventAdmin("e-1");
      expect(res.success).toBe(true);
      expect(mockEventDelete).toHaveBeenCalledWith({ where: { id: "e-1" } });
    });

    it("manages invite codes", async () => {
      const mockCode = { id: "c-1", code: "TEST_CODE", maxUses: null, expiresAt: null, note: "Note" };
      mockHostInviteCodeCreate.mockResolvedValue(mockCode);

      // Stub findUnique to ensure code doesn't exist yet
      mockHostInviteCodeFindUnique.mockResolvedValue(null);

      const res = await createInviteCode({ code: "TEST_CODE", note: "Note" });
      expect(res.success).toBe(true);
      expect(res.code).toEqual(mockCode);
    });

    it("fetches system config", async () => {
      mockSystemConfigFindMany.mockResolvedValue([{ key: "open_registration", value: "true" }]);
      const config = await getSystemConfig();
      expect(config.open_registration).toBe("true");
    });

    it("updates system config setting", async () => {
      mockSystemConfigUpsert.mockResolvedValue({ key: "open_registration", value: "true" });
      const res = await updateSystemConfig("open_registration", "true");
      expect(res.success).toBe(true);
      expect(mockSystemConfigUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: "open_registration" },
          update: { value: "true" },
          create: { key: "open_registration", value: "true" },
        })
      );
    });
  });
});
