import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockCronSchedule,
  mockCronValidate,
  mockProcessReminders,
  mockRunBackup,
  mockSystemConfigFindUnique,
  mockCronLockDeleteMany,
  mockCronLockCreate,
  mockCronLockDelete,
  mockUserFindMany,
} = vi.hoisted(() => ({
  mockCronSchedule: vi.fn(),
  mockCronValidate: vi.fn().mockReturnValue(true),
  mockProcessReminders: vi.fn().mockResolvedValue(undefined),
  mockRunBackup: vi.fn().mockResolvedValue("backup.sqlite"),
  mockSystemConfigFindUnique: vi.fn(),
  mockCronLockDeleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockCronLockCreate: vi.fn().mockResolvedValue({}),
  mockCronLockDelete: vi.fn().mockResolvedValue({}),
  mockUserFindMany: vi.fn().mockResolvedValue([]),
}));

vi.mock("node-cron", () => {
  const m = {
    schedule: mockCronSchedule,
    validate: mockCronValidate,
  };
  return {
    default: m,
    ...m,
  };
});

vi.mock("@/lib/reminders", () => ({
  processReminders: mockProcessReminders,
}));

vi.mock("@/lib/backup", () => ({
  runBackup: mockRunBackup,
}));

vi.mock("@/lib/db", () => ({
  db: {
    systemConfig: {
      findUnique: mockSystemConfigFindUnique,
    },
    cronLock: {
      deleteMany: mockCronLockDeleteMany,
      create: mockCronLockCreate,
      delete: mockCronLockDelete,
    },
    user: {
      findMany: mockUserFindMany,
    },
  },
}));

let startInProcessCron: () => Promise<void>;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("@/lib/cron-scheduler");
  startInProcessCron = mod.startInProcessCron;

  vi.clearAllMocks();
  mockSystemConfigFindUnique.mockResolvedValue(null);
  mockCronValidate.mockReturnValue(true);
  mockCronSchedule.mockReturnValue({
    stop: vi.fn(),
  });
  delete process.env.BACKUP_SCHEDULE;
});

describe("lib/cron-scheduler.ts", () => {
  it("starts the cron jobs and runs initial syncs", async () => {
    process.env.BACKUP_SCHEDULE = "0 0 * * *";
    mockSystemConfigFindUnique.mockResolvedValue({ value: "0 1 * * *" });

    await startInProcessCron();

    // Verify initial processReminders check
    expect(mockProcessReminders).toHaveBeenCalled();

    // Verify node-cron.schedule is called for:
    // 1) Reminders schedule check every 15 minutes (*/15 * * * *)
    // 2) Backup schedule sync check every 5 minutes (*/5 * * * *)
    // 3) Scheduled database backup job (0 1 * * *)
    expect(mockCronSchedule).toHaveBeenCalledWith("*/15 * * * *", expect.any(Function));
    expect(mockCronSchedule).toHaveBeenCalledWith("*/5 * * * *", expect.any(Function));
    expect(mockCronSchedule).toHaveBeenCalledWith("0 1 * * *", expect.any(Function));
  });

  it("executes the cron callbacks when triggered", async () => {
    const callbacks = {
      reminder: undefined as (() => void | Promise<void>) | undefined,
      backup: undefined as (() => void | Promise<void>) | undefined,
    };

    mockCronSchedule.mockImplementation((pattern, cb) => {
      if (pattern === "*/15 * * * *") callbacks.reminder = cb as () => void;
      if (pattern === "0 1 * * *") callbacks.backup = cb as () => void;
      return { stop: vi.fn() };
    });

    process.env.BACKUP_SCHEDULE = "0 1 * * *";
    await startInProcessCron();

    // Trigger reminder callback
    await callbacks.reminder?.();
    expect(mockProcessReminders).toHaveBeenCalledTimes(2); // startup + trigger

    // Trigger backup callback
    await callbacks.backup?.();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockRunBackup).toHaveBeenCalled();
  });

  it("does not schedule backup when pattern is disabled or false", async () => {
    process.env.BACKUP_SCHEDULE = "disabled";
    await startInProcessCron();
    expect(mockCronSchedule).toHaveBeenCalledTimes(3); // 15m reminders, 5m backup sync, daily deletion
  });

  it("stops existing backup task when schedule changes", async () => {
    const callbacks = {
      sync: undefined as (() => void | Promise<void>) | undefined,
    };
    const stopMock = vi.fn();
    mockCronSchedule.mockImplementation((pattern, cb) => {
      if (pattern === "*/5 * * * *") callbacks.sync = cb as () => void;
      return { stop: stopMock };
    });

    mockSystemConfigFindUnique.mockResolvedValueOnce({ value: "0 1 * * *" });
    await startInProcessCron();

    // Change DB config on second sync run
    mockSystemConfigFindUnique.mockResolvedValueOnce({ value: "0 2 * * *" });
    await callbacks.sync?.();

    expect(stopMock).toHaveBeenCalled();
  });

  it("logs error and does not schedule if cron validation fails", async () => {
    mockCronValidate.mockReturnValue(false);
    process.env.BACKUP_SCHEDULE = "invalid pattern";

    await startInProcessCron();
    expect(mockCronSchedule).toHaveBeenCalledTimes(3); // 15m reminders, 5m backup sync, daily deletion
  });

  it("handles processReminders errors silently in startup and cron callbacks", async () => {
    const callbacks = {
      reminder: undefined as (() => void | Promise<void>) | undefined,
    };
    mockCronSchedule.mockImplementation((pattern, cb) => {
      if (pattern === "*/15 * * * *") callbacks.reminder = cb as () => void;
      return { stop: vi.fn() };
    });

    mockProcessReminders.mockRejectedValue(new Error("Reminder query failed"));
    await startInProcessCron();

    // Trigger the callback which should handle errors silently
    callbacks.reminder?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("handles runBackup errors silently inside scheduled backup task callback", async () => {
    const callbacks = {
      backup: undefined as (() => void | Promise<void>) | undefined,
      sync: undefined as (() => void | Promise<void>) | undefined,
    };
    mockCronSchedule.mockImplementation((pattern, cb) => {
      if (pattern === "0 1 * * *") callbacks.backup = cb as () => void;
      if (pattern === "*/5 * * * *") callbacks.sync = cb as () => void;
      return { stop: vi.fn() };
    });

    process.env.BACKUP_SCHEDULE = "0 1 * * *";
    mockRunBackup.mockRejectedValue(new Error("Backup exec failed"));

    await startInProcessCron();

    // Trigger backup callback
    callbacks.backup?.();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Trigger sync callback
    callbacks.sync?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
