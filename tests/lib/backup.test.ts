import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const { mockSystemConfigFindUnique, mockSystemConfigUpsert, mockExecuteRawUnsafe, mockExec } = vi.hoisted(() => ({
  mockSystemConfigFindUnique: vi.fn(),
  mockSystemConfigUpsert: vi.fn(),
  mockExecuteRawUnsafe: vi.fn(),
  mockExec: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    systemConfig: {
      findUnique: mockSystemConfigFindUnique,
      upsert: mockSystemConfigUpsert,
    },
    $executeRawUnsafe: mockExecuteRawUnsafe,
  },
}));

vi.mock("child_process", () => ({
  exec: mockExec,
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
    
    // Make executeRawUnsafe create a dummy file to simulate SQLite vacuum output
    mockExecuteRawUnsafe.mockImplementation(async (query: string) => {
      const match = query.match(/VACUUM INTO '(.*)'/);
      if (match && match[1]) {
        fs.writeFileSync(match[1], "dummy sqlite backup data");
      }
      return {};
    });

    mockExec.mockImplementation((cmd, options, cb) => {
      const callback = cb || options;
      // Extract file path from cmd (e.g. pg_dump -f "/path/to/file")
      const match = cmd.match(/-f "(.*)"/);
      if (match && match[1]) {
        fs.writeFileSync(match[1], "dummy postgres backup data");
      }
      callback(null, { stdout: "success", stderr: "" });
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
    it("lists backup files in backups folder sorted newest first", async () => {
      const testFile1 = path.join(BACKUPS_DIR, "backup_test_1.sql");
      const testFile2 = path.join(BACKUPS_DIR, "backup_test_2.sqlite");
      
      fs.writeFileSync(testFile1, "test postgres backup");
      fs.writeFileSync(testFile2, "test sqlite backup");

      // Adjust mtimes to control sort order
      const time1 = new Date();
      const time2 = new Date(time1.getTime() - 10000); // file2 is older
      fs.utimesSync(testFile1, time1, time1);
      fs.utimesSync(testFile2, time2, time2);

      const list = await listBackups();
      const testList = list.filter((b) => b.filename.startsWith("backup_test_"));
      expect(testList.length).toBe(2);
      expect(testList[0].filename).toBe("backup_test_1.sql");
      expect(testList[1].filename).toBe("backup_test_2.sqlite");
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
    it("runs SQLite backup successfully using VACUUM INTO", async () => {
      process.env.DATABASE_URL = "file:./dev.db";
      
      const filename = await runBackup();
      expect(filename).toContain(".sqlite");
      expect(mockExecuteRawUnsafe).toHaveBeenCalled();
      expect(mockSystemConfigUpsert).toHaveBeenCalled();
    });

    it("throws error if SQLite backup query fails", async () => {
      process.env.DATABASE_URL = "file:./dev.db";
      mockExecuteRawUnsafe.mockRejectedValue(new Error("VACUUM error"));

      await expect(runBackup()).rejects.toThrow("SQLite backup copy failed");
    });

    it("runs PostgreSQL backup successfully using pg_dump", async () => {
      process.env.DATABASE_URL = "postgres://user:password@localhost:5432/rsvp";
      
      const filename = await runBackup();
      expect(filename).toContain(".sql");
      expect(mockExec).toHaveBeenCalled();
      expect(mockSystemConfigUpsert).toHaveBeenCalled();
    });

    it("throws error if pg_dump execution fails", async () => {
      process.env.DATABASE_URL = "postgres://user:password@localhost:5432/rsvp";
      mockExec.mockImplementation((cmd, options, cb) => {
        const callback = cb || options;
        callback(new Error("pg_dump binary not found"), { stdout: "", stderr: "" });
      });

      await expect(runBackup()).rejects.toThrow("pg_dump failed");
    });

    it("throws error for invalid PostgreSQL DATABASE_URL format", async () => {
      process.env.DATABASE_URL = "postgres://invalid url";
      await expect(runBackup()).rejects.toThrow("Invalid DATABASE_URL format");
    });

    it("rotates backups, keeping only the configured keepCount", async () => {
      process.env.DATABASE_URL = "file:./dev.db";
      mockSystemConfigFindUnique.mockResolvedValue({ value: "2" }); // Keep only 2 backups

      // Create 3 existing backup files in BACKUPS_DIR
      const file1 = path.join(BACKUPS_DIR, "backup_rotate_1.sqlite");
      const file2 = path.join(BACKUPS_DIR, "backup_rotate_2.sqlite");
      const file3 = path.join(BACKUPS_DIR, "backup_rotate_3.sqlite");

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
      
      const remainingFiles = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith("backup_rotate_") || f === newBackupName);
      // We expect the new backup and backup_rotate_1 (newest of the old) to remain.
      // backup_rotate_2 and backup_rotate_3 (oldest) should be rotated (deleted).
      expect(remainingFiles.length).toBe(2);
      expect(remainingFiles).toContain(newBackupName);
      expect(remainingFiles).toContain("backup_rotate_1.sqlite");
      expect(remainingFiles).not.toContain("backup_rotate_2.sqlite");
      expect(remainingFiles).not.toContain("backup_rotate_3.sqlite");
    });
  });
});
