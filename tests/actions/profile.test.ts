import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockUserFindUnique,
  mockUserUpdate,
  mockMagicTokenCreate,
  mockMagicTokenUpdateMany,
  mockGetSession,
  mockSendMagicLinkEmail,
  mockSendMagicLinkSms,
  mockUserFindFirst,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockMagicTokenCreate: vi.fn(),
  mockMagicTokenUpdateMany: vi.fn(),
  mockGetSession: vi.fn(),
  mockSendMagicLinkEmail: vi.fn(),
  mockSendMagicLinkSms: vi.fn(),
  mockUserFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
      findFirst: mockUserFindFirst,
    },
    magicToken: {
      create: mockMagicTokenCreate,
      updateMany: mockMagicTokenUpdateMany,
    },
  },
}));

vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/email", () => ({ sendMagicLinkEmail: mockSendMagicLinkEmail }));
vi.mock("@/lib/sms", () => ({ sendMagicLinkSms: mockSendMagicLinkSms }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  updateProfileSettings,
  updateNotificationSettings,
  getUserProfile,
} from "@/app/actions/profile";

describe("app/actions/profile.ts", () => {
  const USER_ID = "user-123";
  const USER_EMAIL = "user@example.com";
  const USER_PHONE = "+15555555555";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateProfileSettings", () => {
    it("throws error if unauthorized", async () => {
      mockGetSession.mockResolvedValue(null);
      await expect(
        updateProfileSettings({ name: "New Name" })
      ).rejects.toThrow("Unauthorized");
    });

    it("updates name and avatar immediately", async () => {
      mockGetSession.mockResolvedValue({ userId: USER_ID, email: USER_EMAIL, role: "HOST" });
      mockUserFindUnique.mockResolvedValue({
        id: USER_ID,
        name: "Old Name",
        email: USER_EMAIL,
        phone: USER_PHONE,
      });

      const res = await updateProfileSettings({
        name: "New Name",
        avatarUrl: "/uploads/avatar.jpg",
      });

      expect(res.success).toBe(true);
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data: {
            name: "New Name",
            avatarUrl: "/uploads/avatar.jpg",
          },
        })
      );
    });

    it("triggers verification flow on email change", async () => {
      mockGetSession.mockResolvedValue({ userId: USER_ID, email: USER_EMAIL, role: "HOST" });
      mockUserFindUnique.mockResolvedValue({
        id: USER_ID,
        name: "Name",
        email: USER_EMAIL,
        phone: USER_PHONE,
      });

      // Mock unique checks: no existing user with new email
      mockUserFindUnique.mockImplementation(async (query: { where?: { email?: string; id?: string } }) => {
        if (query?.where?.email === "new@example.com") return null;
        return { id: USER_ID };
      });

      const res = await updateProfileSettings({
        name: "Name",
        email: "new@example.com",
      });

      expect(res.success).toBe(true);
      expect(res.messages[0]).toContain("verification link has been sent to your new email");
      expect(mockMagicTokenCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            type: "EMAIL_CHANGE",
            metadata: "new@example.com",
          }),
        })
      );
      expect(mockSendMagicLinkEmail).toHaveBeenCalledWith(
        "new@example.com",
        expect.stringContaining("/auth/verify-change?token=")
      );
    });
  });

  describe("updateNotificationSettings", () => {
    it("updates notification toggles in db", async () => {
      mockGetSession.mockResolvedValue({ userId: USER_ID, email: USER_EMAIL, role: "HOST" });

      const res = await updateNotificationSettings({
        emailNotifications: false,
        smsNotifications: true,
      });

      expect(res.success).toBe(true);
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data: {
            emailNotifications: false,
            smsNotifications: true,
          },
        })
      );
    });
  });

  describe("getUserProfile", () => {
    it("returns null when no session", async () => {
      mockGetSession.mockResolvedValue(null);
      const result = await getUserProfile();
      expect(result).toBeNull();
    });

    it("returns user data including notifications", async () => {
      mockGetSession.mockResolvedValue({ userId: USER_ID, email: USER_EMAIL, role: "HOST" });
      const mockUser = { id: USER_ID, name: "Joe", email: USER_EMAIL, phone: null, role: "HOST" };
      mockUserFindUnique.mockResolvedValue(mockUser);

      const result = await getUserProfile();
      expect(result).toEqual(mockUser);
    });
  });

  describe("updateProfileSettings — phone change and duplicate rejection", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({ userId: USER_ID, email: USER_EMAIL, role: "HOST" });
    });

    it("creates MagicToken with type='PHONE_CHANGE' when phone changes", async () => {
      mockUserFindUnique.mockImplementation(async (query: { where: { id?: string; email?: string; phone?: string } }) => {
        if (query?.where?.id === USER_ID) {
          return {
            id: USER_ID,
            name: "Name",
            email: USER_EMAIL,
            phone: USER_PHONE,
          };
        }
        return null;
      });
      mockMagicTokenCreate.mockResolvedValue({});

      const res = await updateProfileSettings({
        name: "Name",
        phone: "+15559876543",
      });

      expect(res.success).toBe(true);
      expect(res.messages[0]).toContain("verification link has been sent to your new phone");
      expect(mockMagicTokenCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            type: "PHONE_CHANGE",
            metadata: "+15559876543",
          }),
        })
      );
    });

    it("returns error when new email is already taken by another account", async () => {
      mockUserFindUnique.mockImplementation(async (query: { where: { id?: string; email?: string; phone?: string } }) => {
        if (query?.where?.id === USER_ID) {
          return {
            id: USER_ID,
            name: "Name",
            email: USER_EMAIL,
            phone: USER_PHONE,
          };
        }
        if (query?.where?.email === "taken@example.com") {
          return { id: "another-user", email: "taken@example.com" };
        }
        return null;
      });

      await expect(
        updateProfileSettings({
          name: "Name",
          email: "taken@example.com",
        })
      ).rejects.toThrow("An account with this email already exists.");
    });

    it("returns error when new phone is already taken by another account", async () => {
      mockUserFindUnique.mockImplementation(async (query: { where: { id?: string; email?: string; phone?: string } }) => {
        if (query?.where?.id === USER_ID) {
          return {
            id: USER_ID,
            name: "Name",
            email: USER_EMAIL,
            phone: USER_PHONE,
          };
        }
        if (query?.where?.phone === "+15559876543") {
          return { id: "another-user", phone: "+15559876543" };
        }
        return null;
      });

      await expect(
        updateProfileSettings({
          name: "Name",
          phone: "+15559876543",
        })
      ).rejects.toThrow("An account with this phone number already exists.");
    });
  });
});
