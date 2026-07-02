import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockUserUpdate,
  mockUserFindUnique,
  mockRsvpDeleteMany,
  mockCoHostDeleteMany,
  mockMagicTokenDeleteMany,
  mockSessionDeleteMany,
  mockEventUpdateMany,
} = vi.hoisted(() => ({
  mockUserUpdate: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockRsvpDeleteMany: vi.fn(),
  mockCoHostDeleteMany: vi.fn(),
  mockMagicTokenDeleteMany: vi.fn(),
  mockSessionDeleteMany: vi.fn(),
  mockEventUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      update: mockUserUpdate,
      findUnique: mockUserFindUnique,
    },
    rSVP: {
      deleteMany: mockRsvpDeleteMany,
    },
    eventCoHost: {
      deleteMany: mockCoHostDeleteMany,
    },
    magicToken: {
      deleteMany: mockMagicTokenDeleteMany,
    },
    session: {
      deleteMany: mockSessionDeleteMany,
    },
    event: {
      updateMany: mockEventUpdateMany,
    },
  },
}));

import { cancelUserDeletion, performImmediateUserDeletion } from "@/lib/account-deletion";

describe("lib/account-deletion.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cancelUserDeletion", () => {
    it("resets deletionRequestedAt and deletionScheduledAt to null", async () => {
      mockUserUpdate.mockResolvedValue({});
      await cancelUserDeletion("user-123");

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { deletionRequestedAt: null, deletionScheduledAt: null },
      });
    });
  });

  describe("performImmediateUserDeletion", () => {
    it("anonymizes the user and deletes references", async () => {
      mockUserFindUnique.mockResolvedValue({
        id: "user-123",
        name: "Joe",
        email: "joe@example.com",
      });
      mockUserUpdate.mockResolvedValue({});

      await performImmediateUserDeletion("user-123");

      expect(mockRsvpDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-123" } });
      expect(mockCoHostDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-123" } });
      expect(mockMagicTokenDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-123" } });
      expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-123" } });
      expect(mockEventUpdateMany).toHaveBeenCalledWith({
        where: { hostId: "user-123" },
        data: { hostId: "system" },
      });
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: {
          email: null,
          phone: null,
          name: "Deleted User",
          avatarUrl: null,
          role: "GUEST",
          deletionRequestedAt: null,
          deletionScheduledAt: null,
        },
      });
    });
  });
});
