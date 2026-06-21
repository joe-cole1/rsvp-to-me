import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock node-cron
const mockSchedule = vi.fn().mockReturnValue({ stop: vi.fn() });
const mockValidate = vi.fn().mockReturnValue(true);
vi.mock("node-cron", () => ({
  default: {
    schedule: mockSchedule,
    validate: mockValidate,
  },
}));

// Mock reminders & backup
const mockProcessReminders = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/reminders", () => ({
  processReminders: mockProcessReminders,
}));

const mockRunBackup = vi.fn().mockResolvedValue("mock-backup-file");
vi.mock("@/lib/backup", () => ({
  runBackup: mockRunBackup,
  getBackupKeepCount: vi.fn().mockResolvedValue(7),
}));

// Mock DB
const mockFindUnique = vi.fn().mockResolvedValue({ value: "0 0 * * *" });
vi.mock("@/lib/db", () => ({
  db: {
    systemConfig: {
      findUnique: mockFindUnique,
    },
  },
}));

describe("lib/cron-scheduler.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers cron jobs and performs startup runs", async () => {
    const { startInProcessCron } = await import("@/lib/cron-scheduler");
    
    await startInProcessCron();

    // Verify reminders are checked immediately on startup
    expect(mockProcessReminders).toHaveBeenCalled();

    // Verify schedule is called for reminders (every 15 min), and backup config sync (every 5 min)
    expect(mockSchedule).toHaveBeenCalledWith("*/15 * * * *", expect.any(Function));
    expect(mockSchedule).toHaveBeenCalledWith("*/5 * * * *", expect.any(Function));

    // Verify it schedules the backup pattern fetched from DB
    expect(mockSchedule).toHaveBeenCalledWith("0 0 * * *", expect.any(Function));
  });
});
