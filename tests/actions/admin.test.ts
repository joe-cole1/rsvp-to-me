import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockUserCount,
  mockEventCount,
  mockRsvpCount,
  mockCheckInCount,
  mockHostInviteCodeCount,
  mockUserFindMany,
  mockUserFindUnique,
  mockUserCreate,
  mockUserUpdate,
  mockUserDelete,
  mockMagicTokenCreate,
  mockEventFindMany,
  mockEventDelete,
  mockHostInviteCodeFindMany,
  mockHostInviteCodeCreate,
  mockHostInviteCodeDelete,
  mockHostInviteCodeFindUnique,
  mockSystemConfigFindMany,
  mockSystemConfigUpsert,
  mockSystemConfigDeleteMany,
  mockGetSession,
  mockTestEmailConfig,
  mockSendWelcomeEmail,
  mockTestSmsConfig,
  mockRunBackup,
  mockListBackups,
  mockDeleteBackup,
  mockGetBackupKeepCount,
  mockTransaction,
  mockThemePresetFindMany,
  mockThemePresetAggregate,
  mockThemePresetCreate,
  mockThemePresetUpdate,
  mockThemePresetDelete,
  mockRsvpDeleteMany,
  mockCoHostDeleteMany,
  mockMagicTokenDeleteMany,
  mockSessionDeleteMany,
  mockEventUpdateMany,
} = vi.hoisted(() => ({
  mockUserCount: vi.fn(),
  mockEventCount: vi.fn(),
  mockRsvpCount: vi.fn(),
  mockCheckInCount: vi.fn(),
  mockHostInviteCodeCount: vi.fn(),
  mockUserFindMany: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockUserDelete: vi.fn(),
  mockMagicTokenCreate: vi.fn(),
  mockEventFindMany: vi.fn(),
  mockEventDelete: vi.fn(),
  mockHostInviteCodeFindMany: vi.fn(),
  mockHostInviteCodeCreate: vi.fn(),
  mockHostInviteCodeDelete: vi.fn(),
  mockHostInviteCodeFindUnique: vi.fn(),
  mockSystemConfigFindMany: vi.fn(),
  mockSystemConfigUpsert: vi.fn(),
  mockSystemConfigDeleteMany: vi.fn(),
  mockGetSession: vi.fn(),
  mockTestEmailConfig: vi.fn(),
  mockSendWelcomeEmail: vi.fn(),
  mockTestSmsConfig: vi.fn(),
  mockRunBackup: vi.fn(),
  mockListBackups: vi.fn(),
  mockDeleteBackup: vi.fn(),
  mockGetBackupKeepCount: vi.fn(),
  mockTransaction: vi.fn((ops) => Promise.all(ops)),
  mockThemePresetFindMany: vi.fn(),
  mockThemePresetAggregate: vi.fn(),
  mockThemePresetCreate: vi.fn(),
  mockThemePresetUpdate: vi.fn(),
  mockThemePresetDelete: vi.fn(),
  mockRsvpDeleteMany: vi.fn(),
  mockCoHostDeleteMany: vi.fn(),
  mockMagicTokenDeleteMany: vi.fn(),
  mockSessionDeleteMany: vi.fn(),
  mockEventUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      count: mockUserCount,
      findMany: mockUserFindMany,
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
      update: mockUserUpdate,
      delete: mockUserDelete,
    },
    magicToken: {
      create: mockMagicTokenCreate,
      deleteMany: mockMagicTokenDeleteMany,
    },
    event: {
      count: mockEventCount,
      findMany: mockEventFindMany,
      delete: mockEventDelete,
      updateMany: mockEventUpdateMany,
    },
    rSVP: {
      count: mockRsvpCount,
      deleteMany: mockRsvpDeleteMany,
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
      deleteMany: mockCoHostDeleteMany,
    },
    session: {
      deleteMany: mockSessionDeleteMany,
    },
    systemConfig: {
      findMany: mockSystemConfigFindMany,
      upsert: mockSystemConfigUpsert,
      deleteMany: mockSystemConfigDeleteMany,
      findUnique: vi.fn(),
    },
    themePreset: {
      findMany: mockThemePresetFindMany,
      aggregate: mockThemePresetAggregate,
      create: mockThemePresetCreate,
      update: mockThemePresetUpdate,
      delete: mockThemePresetDelete,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/session", () => ({
  getSession: mockGetSession,
  invalidateUserSessions: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({
  testEmailConfig: mockTestEmailConfig,
  sendWelcomeEmail: mockSendWelcomeEmail,
}));
vi.mock("@/lib/sms", () => ({
  testSmsConfig: mockTestSmsConfig,
}));
vi.mock("@/lib/backup", () => ({
  runBackup: mockRunBackup,
  listBackups: mockListBackups,
  deleteBackup: mockDeleteBackup,
  getBackupKeepCount: mockGetBackupKeepCount,
}));

import {
  getAdminStats,
  getAdminUsers,
  updateUserRole,
  deleteUserAccount,
  cancelAccountDeletion,
  deleteUserAccountImmediately,
  createAdminUser,
  getAdminEvents,
  deleteEventAdmin,
  createInviteCode,
  getSystemConfig,
  updateSystemConfig,
  testEmailConfigAction,
  revokeInviteCode,
  getInviteCodes,
  testSmsConfigAction,
  createBackupAction,
  listBackupsAction,
  deleteBackupAction,
  getBackupConfig,
  updateBackupConfigAction,
  getThemePresets,
  createThemePreset,
  updateThemePreset,
  deleteThemePreset,
  resetAllEmailTemplatesAction,
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
      mockGetSession.mockResolvedValue({
        userId: ADMIN_ID,
        email: "admin@example.com",
        role: "ADMIN",
      });
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
      await expect(updateUserRole(ADMIN_ID, "HOST")).rejects.toThrow(
        "You cannot change your own admin role."
      );
    });

    it("prevents changing the role of the system user", async () => {
      await expect(updateUserRole("system", "HOST")).rejects.toThrow(
        "You cannot change the role of the system user."
      );
    });

    it("prevents scheduling the system user for deletion", async () => {
      await expect(deleteUserAccount("system")).rejects.toThrow(
        "You cannot delete the system user."
      );
    });

    it("schedules user account for deletion", async () => {
      mockEventFindMany.mockResolvedValue([]);
      mockUserUpdate.mockResolvedValue({ id: "u-1" });

      const res = await deleteUserAccount("u-1");
      expect(res.success).toBe(true);
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u-1" },
          data: expect.objectContaining({
            deletionRequestedAt: expect.any(Date),
            deletionScheduledAt: expect.any(Date),
          }),
        })
      );
      expect(mockUserDelete).not.toHaveBeenCalled();
    });

    it("blocks deletion when user has upcoming published events", async () => {
      mockEventFindMany.mockResolvedValue([{ id: "e-1", title: "Big Party", slug: "big-party" }]);

      const res = await deleteUserAccount("u-1");
      expect("blocked" in res && res.blocked).toBe(true);
      expect(mockUserUpdate).not.toHaveBeenCalled();
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
      const mockCode = {
        id: "c-1",
        code: "TEST_CODE",
        maxUses: null,
        expiresAt: null,
        note: "Note",
      };
      mockHostInviteCodeCreate.mockResolvedValue(mockCode);

      // Stub findUnique to ensure code doesn't exist yet
      mockHostInviteCodeFindUnique.mockResolvedValue(null);

      const res = await createInviteCode({ code: "TEST_CODE", note: "Note" });
      expect(res.success).toBe(true);
      expect(res.code).toEqual(mockCode);
    });

    it("fetches system config and masks sensitive values", async () => {
      mockSystemConfigFindMany.mockResolvedValue([
        { key: "open_registration", value: "true" },
        { key: "smtp_pass", value: "super-secret-password" },
        { key: "cloudflare_worker_api_secret", value: "worker-api-token" },
        { key: "cloudflare_api_token", value: "cf-api-token" },
        { key: "twilio_auth_token", value: "iv:tag:encrypted-twilio-token" },
      ]);
      const config = await getSystemConfig();
      expect(config.open_registration).toBe("true");
      expect(config.smtp_pass).toBe("••••••••");
      expect(config.cloudflare_worker_api_secret).toBe("••••••••");
      expect(config.cloudflare_api_token).toBe("••••••••");
      // L-5: the Twilio auth token must never reach the admin client — neither
      // decrypted nor as raw ciphertext.
      expect(config.twilio_auth_token).toBe("••••••••");
    });

    it("masks the Twilio auth token even when it comes from the env fallback (L-5)", async () => {
      mockSystemConfigFindMany.mockResolvedValue([]);
      process.env.TWILIO_AUTH_TOKEN = "env-twilio-secret";
      try {
        const config = await getSystemConfig();
        expect(config.twilio_auth_token).toBe("••••••••");
        expect(JSON.stringify(config)).not.toContain("env-twilio-secret");
      } finally {
        delete process.env.TWILIO_AUTH_TOKEN;
      }
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

    it("skips updating sensitive config setting if the value is the mask placeholder", async () => {
      mockSystemConfigUpsert.mockClear();
      const res = await updateSystemConfig("smtp_pass", "••••••••");
      expect(res.success).toBe(true);
      expect(mockSystemConfigUpsert).not.toHaveBeenCalled();
    });

    it("resetAllEmailTemplatesAction clears every email_template_ override", async () => {
      mockSystemConfigDeleteMany.mockResolvedValue({ count: 3 });
      const res = await resetAllEmailTemplatesAction();
      expect(res).toEqual({ success: true, cleared: 3 });
      expect(mockSystemConfigDeleteMany).toHaveBeenCalledWith({
        where: { key: { startsWith: "email_template_" } },
      });
    });

    it("resetAllEmailTemplatesAction reports zero when nothing was overridden", async () => {
      mockSystemConfigDeleteMany.mockResolvedValue({ count: 0 });
      const res = await resetAllEmailTemplatesAction();
      expect(res).toEqual({ success: true, cleared: 0 });
    });

    it("keeps twilio_auth_token write-only: echoing the mask back is a no-op (L-5)", async () => {
      mockSystemConfigUpsert.mockClear();
      const res = await updateSystemConfig("twilio_auth_token", "••••••••");
      expect(res.success).toBe(true);
      expect(mockSystemConfigUpsert).not.toHaveBeenCalled();
    });

    it("runs testEmailConfigAction successfully, resolving masked passwords from database", async () => {
      mockTestEmailConfig.mockResolvedValue({ success: true });
      // Stub db.systemConfig.findUnique for SMTP password, Cloudflare secret, and Cloudflare API token
      const mockFindUnique = vi.fn().mockImplementation(({ where }) => {
        if (where.key === "smtp_pass") return Promise.resolve({ value: "actual-smtp-password" });
        if (where.key === "cloudflare_worker_api_secret")
          return Promise.resolve({ value: "actual-worker-secret" });
        if (where.key === "cloudflare_api_token")
          return Promise.resolve({ value: "actual-cf-api-token" });
        return Promise.resolve(null);
      });
      // Add mock to db
      const { db } = await import("@/lib/db");
      db.systemConfig.findUnique = mockFindUnique;

      const res = await testEmailConfigAction({
        provider: "smtp",
        from: "noreply@example.com",
        smtpHost: "smtp.example.com",
        smtpPort: "587",
        smtpSecure: false,
        smtpUser: "user",
        smtpPass: "••••••••",
        cfWorkerUrl: "https://worker.example.com",
        cfWorkerSecret: "••••••••",
        cfAccountId: "cf-account-id",
        cfApiToken: "••••••••",
      });

      expect(res.success).toBe(true);
      expect(mockTestEmailConfig).toHaveBeenCalledWith(
        "admin@example.com",
        expect.objectContaining({
          provider: "smtp",
          smtp: expect.objectContaining({
            host: "smtp.example.com",
            pass: "actual-smtp-password",
          }),
          cloudflare: expect.objectContaining({
            secret: "actual-worker-secret",
            accountId: "cf-account-id",
            apiToken: "actual-cf-api-token",
          }),
        })
      );
    });

    it("runs testEmailConfigAction and respects non-masked secrets", async () => {
      mockTestEmailConfig.mockResolvedValue({ success: true });
      const res = await testEmailConfigAction({
        provider: "cloudflare",
        from: "noreply@example.com",
        smtpHost: "",
        smtpPort: "587",
        smtpSecure: false,
        smtpUser: "",
        smtpPass: "",
        cfWorkerUrl: "https://worker.example.com",
        cfWorkerSecret: "newly-generated-secret",
      });

      expect(res.success).toBe(true);
      expect(mockTestEmailConfig).toHaveBeenCalledWith(
        "admin@example.com",
        expect.objectContaining({
          provider: "cloudflare",
          cloudflare: expect.objectContaining({
            secret: "newly-generated-secret",
          }),
        })
      );
    });

    it("revokes invite code", async () => {
      mockHostInviteCodeDelete.mockResolvedValue({});
      const res = await revokeInviteCode("c-1");
      expect(res.success).toBe(true);
      expect(mockHostInviteCodeDelete).toHaveBeenCalledWith({ where: { id: "c-1" } });
    });

    it("gets invite codes", async () => {
      mockHostInviteCodeFindMany.mockResolvedValue([]);
      const res = await getInviteCodes();
      expect(res).toEqual([]);
      expect(mockHostInviteCodeFindMany).toHaveBeenCalled();
    });

    it("tests SMS configuration", async () => {
      mockTestSmsConfig.mockResolvedValue({ success: true });
      const res = await testSmsConfigAction({
        sid: "sid",
        token: "token",
        phone: "phone",
        testTo: "to",
      });
      expect(res).toEqual({ success: true });
    });

    it("runs backup action", async () => {
      mockRunBackup.mockResolvedValue("backup.sql");
      const res = await createBackupAction();
      expect(res).toEqual({ success: true, filename: "backup.sql" });
    });

    it("lists backup files", async () => {
      mockListBackups.mockResolvedValue(["a.sql"]);
      const res = await listBackupsAction();
      expect(res).toEqual(["a.sql"]);
    });

    it("deletes a backup file", async () => {
      mockDeleteBackup.mockResolvedValue(true);
      const res = await deleteBackupAction("a.sql");
      expect(res).toEqual({ success: true });
    });

    it("gets backup configuration", async () => {
      mockSystemConfigFindMany.mockResolvedValue([]);
      mockGetBackupKeepCount.mockResolvedValue(5);
      const res = await getBackupConfig();
      expect(res.backup_schedule).toBe("disabled");
      expect(res.backup_keep_count).toBe(5);
    });

    it("updates backup configuration", async () => {
      mockTransaction.mockResolvedValue([{}, {}]);
      const res = await updateBackupConfigAction("*/5 * * * *", 10);
      expect(res.success).toBe(true);
      expect(mockTransaction).toHaveBeenCalled();
    });

    describe("Theme Presets", () => {
      const PRESET = {
        id: "dark-night",
        name: "Dark Night",
        emoji: "🌙",
        base: "DARK" as const,
        gradientFrom: "#7c3aed",
        gradientTo: "#1e40af",
        accentColor: "#a855f7",
        seasonal: false,
        month: null,
      };

      it("getThemePresets returns presets ordered by sortOrder then createdAt", async () => {
        mockThemePresetFindMany.mockResolvedValue([PRESET]);
        const res = await getThemePresets();
        expect(res).toEqual([PRESET]);
        expect(mockThemePresetFindMany).toHaveBeenCalledWith({
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });
      });

      it("createThemePreset appends at end of sort order", async () => {
        mockThemePresetAggregate.mockResolvedValue({ _max: { sortOrder: 4 } });
        mockThemePresetCreate.mockResolvedValue({ ...PRESET, id: "new-preset", sortOrder: 5 });
        const res = await createThemePreset(PRESET);
        expect(mockThemePresetCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ sortOrder: 5, active: true }),
          })
        );
        expect(res).toHaveProperty("id");
      });

      it("createThemePreset sets sortOrder 0 when table is empty", async () => {
        mockThemePresetAggregate.mockResolvedValue({ _max: { sortOrder: null } });
        mockThemePresetCreate.mockResolvedValue({ ...PRESET, id: "first", sortOrder: 0 });
        await createThemePreset(PRESET);
        expect(mockThemePresetCreate).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ sortOrder: 0 }) })
        );
      });

      it("updateThemePreset calls update with correct where and data", async () => {
        mockThemePresetUpdate.mockResolvedValue({});
        const res = await updateThemePreset("dark-night", { name: "Dark Night v2", active: false });
        expect(res).toEqual({ success: true });
        expect(mockThemePresetUpdate).toHaveBeenCalledWith({
          where: { id: "dark-night" },
          data: { name: "Dark Night v2", active: false },
        });
      });

      it("deleteThemePreset calls delete with correct id", async () => {
        mockThemePresetDelete.mockResolvedValue({});
        const res = await deleteThemePreset("dark-night");
        expect(res).toEqual({ success: true });
        expect(mockThemePresetDelete).toHaveBeenCalledWith({ where: { id: "dark-night" } });
      });
    });
  });

  describe("Non-admin access", () => {
    it("resetAllEmailTemplatesAction throws Forbidden for non-admin", async () => {
      mockGetSession.mockResolvedValue({ userId: "u-1", email: "u@example.com", role: "HOST" });
      await expect(resetAllEmailTemplatesAction()).rejects.toThrow("Forbidden");
      expect(mockSystemConfigDeleteMany).not.toHaveBeenCalled();
    });

    it("createThemePreset throws Forbidden for non-admin", async () => {
      mockGetSession.mockResolvedValue({ userId: "u-1", email: "u@example.com", role: "HOST" });
      await expect(
        createThemePreset({
          name: "x",
          emoji: "x",
          base: "DARK",
          gradientFrom: "#000",
          gradientTo: "#000",
          accentColor: "#000",
          seasonal: false,
          month: null,
        })
      ).rejects.toThrow("Forbidden");
    });

    it("updateThemePreset throws Forbidden for non-admin", async () => {
      mockGetSession.mockResolvedValue({ userId: "u-1", email: "u@example.com", role: "HOST" });
      await expect(updateThemePreset("dark-night", { active: false })).rejects.toThrow("Forbidden");
    });

    it("deleteThemePreset throws Forbidden for non-admin", async () => {
      mockGetSession.mockResolvedValue({ userId: "u-1", email: "u@example.com", role: "HOST" });
      await expect(deleteThemePreset("dark-night")).rejects.toThrow("Forbidden");
    });
  });

  describe("createAdminUser", () => {
    describe("non-admin access", () => {
      it("throws Forbidden for non-admin", async () => {
        mockGetSession.mockResolvedValue({ userId: "u-1", email: "u@example.com", role: "HOST" });
        await expect(createAdminUser({ email: "new@example.com", role: "GUEST" })).rejects.toThrow(
          "Forbidden"
        );
      });
    });

    describe("authorized (admin)", () => {
      beforeEach(() => {
        mockGetSession.mockResolvedValue({
          userId: "admin-1",
          email: "admin@example.com",
          role: "ADMIN",
        });
        mockSendWelcomeEmail.mockResolvedValue(undefined);
        mockMagicTokenCreate.mockResolvedValue({});
      });

      it("returns error for missing email", async () => {
        const res = await createAdminUser({ email: "", role: "GUEST" });
        expect(res).toEqual({ success: false, error: "Email is required." });
      });

      it("returns error for invalid email format", async () => {
        const res = await createAdminUser({ email: "not-an-email", role: "GUEST" });
        expect(res).toEqual({ success: false, error: "Please enter a valid email address." });
      });

      it("returns error for invalid role", async () => {
        const res = await createAdminUser({
          email: "new@example.com",
          role: "SUPERUSER" as "GUEST",
        });
        expect(res).toEqual({ success: false, error: "Invalid role." });
      });

      it("returns error when email already exists", async () => {
        mockUserFindUnique.mockResolvedValue({ id: "existing-1", email: "new@example.com" });
        const res = await createAdminUser({ email: "new@example.com", role: "GUEST" });
        expect(res).toEqual({ success: false, error: "A user with this email already exists." });
      });

      it("returns error when phone already exists", async () => {
        mockUserFindUnique
          .mockResolvedValueOnce(null) // email check passes
          .mockResolvedValueOnce({ id: "existing-2", phone: "+15550001234" }); // phone check fails
        const res = await createAdminUser({
          email: "new@example.com",
          phone: "+15550001234",
          role: "GUEST",
        });
        expect(res).toEqual({
          success: false,
          error: "A user with this phone number already exists.",
        });
      });

      it("creates user, generates magic token, sends welcome email, and returns success", async () => {
        const { revalidatePath } = await import("next/cache");
        mockUserFindUnique.mockResolvedValue(null);
        mockUserCreate.mockResolvedValue({ id: "new-user-1", email: "new@example.com" });

        const res = await createAdminUser({
          name: "Jane Smith",
          email: "new@example.com",
          phone: "+15550009999",
          role: "HOST",
        });

        expect(res).toEqual({ success: true });
        expect(mockUserCreate).toHaveBeenCalledWith({
          data: {
            name: "Jane Smith",
            email: "new@example.com",
            phone: "+15550009999",
            role: "HOST",
          },
        });
        expect(mockMagicTokenCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ userId: "new-user-1" }),
          })
        );
        expect(mockSendWelcomeEmail).toHaveBeenCalledWith(
          "new@example.com",
          expect.stringContaining("/auth/verify?token=")
        );
        expect(revalidatePath).toHaveBeenCalledWith("/admin");
      });

      it("still returns success if welcome email fails", async () => {
        mockUserFindUnique.mockResolvedValue(null);
        mockUserCreate.mockResolvedValue({ id: "new-user-2", email: "fail@example.com" });
        mockSendWelcomeEmail.mockRejectedValue(new Error("SMTP down"));

        const res = await createAdminUser({ email: "fail@example.com", role: "GUEST" });
        expect(res).toEqual({ success: true });
      });

      it("trims and lowercases email before saving", async () => {
        mockUserFindUnique.mockResolvedValue(null);
        mockUserCreate.mockResolvedValue({ id: "new-user-3", email: "trimmed@example.com" });

        await createAdminUser({ email: "  Trimmed@EXAMPLE.COM  ", role: "GUEST" });

        expect(mockUserCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({ email: "trimmed@example.com" }),
        });
      });

      it("normalizes phone numbers before querying and saving", async () => {
        mockUserFindUnique.mockResolvedValue(null);
        mockUserCreate.mockResolvedValue({ id: "new-user-4", email: "norm@example.com" });

        await createAdminUser({
          email: "norm@example.com",
          phone: " (555) 867-5309 ",
          role: "GUEST",
        });

        expect(mockUserFindUnique).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ where: { phone: "5558675309" } })
        );
        expect(mockUserCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({ phone: "5558675309" }),
        });
      });
    });

    describe("cancelAccountDeletion", () => {
      it("throws error if unauthorized or not admin", async () => {
        mockGetSession.mockResolvedValue(null);
        await expect(cancelAccountDeletion("u-1")).rejects.toThrow(
          "Forbidden: Admin access required"
        );
      });

      it("cancels account deletion for the specified user", async () => {
        mockGetSession.mockResolvedValue({
          userId: "admin-1",
          email: "admin@example.com",
          role: "ADMIN",
        });
        mockUserUpdate.mockResolvedValue({});

        const res = await cancelAccountDeletion("u-1");
        expect(res.success).toBe(true);
        expect(mockUserUpdate).toHaveBeenCalledWith({
          where: { id: "u-1" },
          data: { deletionRequestedAt: null, deletionScheduledAt: null },
        });
      });
    });

    describe("deleteUserAccountImmediately", () => {
      it("throws error if unauthorized or not admin", async () => {
        mockGetSession.mockResolvedValue(null);
        await expect(deleteUserAccountImmediately("u-1")).rejects.toThrow(
          "Forbidden: Admin access required"
        );
      });

      it("throws error if trying to delete own admin account", async () => {
        mockGetSession.mockResolvedValue({
          userId: "admin-1",
          email: "admin@example.com",
          role: "ADMIN",
        });
        await expect(deleteUserAccountImmediately("admin-1")).rejects.toThrow(
          "You cannot delete your own admin account."
        );
      });

      it("throws error if trying to delete the system user", async () => {
        mockGetSession.mockResolvedValue({
          userId: "admin-1",
          email: "admin@example.com",
          role: "ADMIN",
        });
        await expect(deleteUserAccountImmediately("system")).rejects.toThrow(
          "You cannot delete the system user."
        );
      });

      it("deletes user immediately and anonymizes details", async () => {
        mockGetSession.mockResolvedValue({
          userId: "admin-1",
          email: "admin@example.com",
          role: "ADMIN",
        });
        mockUserFindUnique.mockResolvedValue({ id: "u-1", name: "Joe", email: "joe@example.com" });
        mockUserUpdate.mockResolvedValue({});

        const res = await deleteUserAccountImmediately("u-1");
        expect(res.success).toBe(true);
        expect(mockRsvpDeleteMany).toHaveBeenCalledWith({ where: { userId: "u-1" } });
        expect(mockCoHostDeleteMany).toHaveBeenCalledWith({ where: { userId: "u-1" } });
        expect(mockMagicTokenDeleteMany).toHaveBeenCalledWith({ where: { userId: "u-1" } });
        expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "u-1" } });
        expect(mockEventUpdateMany).toHaveBeenCalledWith({
          where: { hostId: "u-1" },
          data: { hostId: "system" },
        });
        expect(mockUserUpdate).toHaveBeenCalledWith({
          where: { id: "u-1" },
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
});
