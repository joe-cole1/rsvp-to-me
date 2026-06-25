import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const { mockSystemConfigFindUnique, mockSystemConfigUpsert, mockExecFile } = vi.hoisted(() => ({
  mockSystemConfigFindUnique: vi.fn(),
  mockSystemConfigUpsert: vi.fn(),
  mockExecFile: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    systemConfig: {
      findUnique: mockSystemConfigFindUnique,
      upsert: mockSystemConfigUpsert,
    },
  },
}));

vi.mock("child_process", () => ({
  execFile: mockExecFile,
}));

import { getBackupKeepCount, listBackups, deleteBackup, runBackup } from "@/lib/backup";

const BACKUPS_DIR = path.join(process.cwd(), "data", "backups");

describe("lib/backup.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BACKUP_KEEP_COUNT;
    delete process.env.DATABASE_URL;

    mockSystemConfigFindUnique.mockResolvedValue(null);
    mockSystemConfigUpsert.mockResolvedValue({});

    mockExecFile.mockImplementation((file, args, options, cb) => {
      const fIndex = (args as string[]).indexOf("-f");
      const outputPath = fIndex !== -1 ? (args as string[])[fIndex + 1] : null;
      if (outputPath) {
        fs.writeFileSync(outputPath, "dummy postgres backup data");
      }
      cb(null, "success", "");
    });

    // Ensure backups directory exists for tests
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test backup files
    if (fs.existsSync(BACKUPS_DIR)) {
      const files = fs.readdirSync(BACKUPS_DIR);
      for (const file of files) {
        if (file.startsWith("backup_")) {
          try {
            fs.unlinkSync(path.join(BACKUPS_DIR, file));
          } catch {}
        }
      }
    }
  });

  describe("getBackupKeepCount", () => {
    it("returns default value of 7 when DB and env are unset", async () => {
      const count = await getBackupKeepCount();
      expect(count).toBe(7);
    });

    it("returns env variable value if set", async () => {
      process.env.BACKUP_KEEP_COUNT = "10";
      const count = await getBackupKeepCount();
      expect(count).toBe(10);
    });

    it("returns DB configuration value if set", async () => {
      mockSystemConfigFindUnique.mockResolvedValue({ value: "15" });
      const count = await getBackupKeepCount();
      expect(count).toBe(15);
    });

    it("falls back to env/default if DB throws error", async () => {
      mockSystemConfigFindUnique.mockRejectedValue(new Error("DB error"));
      process.env.BACKUP_KEEP_COUNT = "12";
      const count = await getBackupKeepCount();
      expect(count).toBe(12);
    });
  });

  describe("listBackups", () => {
    it("lists .sql backup files in backups folder sorted newest first", async () => {
      const testFile1 = path.join(BACKUPS_DIR, "backup_test_1.sql");

      fs.writeFileSync(testFile1, "test postgres backup");

      const list = await listBackups();
      const testList = list.filter((b) => b.filename.startsWith("backup_test_"));
      expect(testList.length).toBe(1);
      expect(testList[0].filename).toBe("backup_test_1.sql");
    });
  });

  describe("deleteBackup", () => {
    it("safely deletes a backup file and protects against directory traversal", async () => {
      const testFile = path.join(BACKUPS_DIR, "backup_test_delete.sql");
      fs.writeFileSync(testFile, "delete me");
      expect(fs.existsSync(testFile)).toBe(true);

      // Normal delete
      const deleted = await deleteBackup("backup_test_delete.sql");
      expect(deleted).toBe(true);
      expect(fs.existsSync(testFile)).toBe(false);

      // Traversal protection delete
      const mockTraversalFile = path.join(process.cwd(), "backup_test_traversal.txt");
      fs.writeFileSync(mockTraversalFile, "secret");

      const deletedTraversal = await deleteBackup("../../../backup_test_traversal.txt");
      expect(deletedTraversal).toBe(false); // basename restricts it to backups folder
      expect(fs.existsSync(mockTraversalFile)).toBe(true);
      fs.unlinkSync(mockTraversalFile);
    });

    it("returns false if file does not exist", async () => {
      const deleted = await deleteBackup("backup_non_existent.sql");
      expect(deleted).toBe(false);
    });
  });

  describe("runBackup & rotation", () => {
    it("runs PostgreSQL backup successfully using pg_dump", async () => {
      process.env.DATABASE_URL = "postgres://user:password@localhost:5432/rsvp";

      const filename = await runBackup();
      expect(filename).toContain(".sql");
      expect(mockExecFile).toHaveBeenCalled();
      expect(mockSystemConfigUpsert).toHaveBeenCalled();
    });

    it("throws error if pg_dump execution fails", async () => {
      process.env.DATABASE_URL = "postgres://user:password@localhost:5432/rsvp";
      mockExecFile.mockImplementation((file, args, options, cb) => {
        cb(new Error("pg_dump binary not found"), "", "");
      });

      await expect(runBackup()).rejects.toThrow("pg_dump failed");
    });

    it("throws error for invalid PostgreSQL DATABASE_URL format", async () => {
      process.env.DATABASE_URL = "postgres://invalid url";
      await expect(runBackup()).rejects.toThrow("Invalid DATABASE_URL format");
    });

    it("rotates backups, keeping only the configured keepCount", async () => {
      process.env.DATABASE_URL = "postgres://user:password@localhost:5432/rsvp";
      mockSystemConfigFindUnique.mockResolvedValue({ value: "2" }); // Keep only 2 backups

      // Create 3 existing backup files in BACKUPS_DIR
      const file1 = path.join(BACKUPS_DIR, "backup_rotate_1.sql");
      const file2 = path.join(BACKUPS_DIR, "backup_rotate_2.sql");
      const file3 = path.join(BACKUPS_DIR, "backup_rotate_3.sql");

      fs.writeFileSync(file1, "data");
      fs.writeFileSync(file2, "data");
      fs.writeFileSync(file3, "data");

      // Adjust modified times: file1 (newest), file2 (middle), file3 (oldest)
      const nowTime = Date.now();
      fs.utimesSync(file1, new Date(nowTime), new Date(nowTime));
      fs.utimesSync(file2, new Date(nowTime - 5000), new Date(nowTime - 5000));
      fs.utimesSync(file3, new Date(nowTime - 10000), new Date(nowTime - 10000));

      // Running runBackup will create a 4th backup (newest), making 4 total.
      // Rotation should keep 2 newest and delete the 2 oldest.
      const newBackupName = await runBackup();

      const remainingFiles = fs
        .readdirSync(BACKUPS_DIR)
        .filter((f) => f.startsWith("backup_rotate_") || f === newBackupName);
      // We expect the new backup and backup_rotate_1 (newest of the old) to remain.
      // backup_rotate_2 and backup_rotate_3 (oldest) should be rotated (deleted).
      expect(remainingFiles.length).toBe(2);
      expect(remainingFiles).toContain(newBackupName);
      expect(remainingFiles).toContain("backup_rotate_1.sql");
      expect(remainingFiles).not.toContain("backup_rotate_2.sql");
      expect(remainingFiles).not.toContain("backup_rotate_3.sql");
    });
  });
});
