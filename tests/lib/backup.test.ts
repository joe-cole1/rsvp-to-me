import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { getBackupKeepCount, listBackups, deleteBackup } from "@/lib/backup";

const BACKUPS_DIR = path.join(process.cwd(), "data", "backups");

describe("lib/backup.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.BACKUP_KEEP_COUNT;
    delete process.env.DATABASE_URL;

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
        if (file.startsWith("backup_test_")) {
          fs.unlinkSync(path.join(BACKUPS_DIR, file));
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
  });

  describe("listBackups", () => {
    it("lists backup files in backups folder", async () => {
      const testFile1 = path.join(BACKUPS_DIR, "backup_test_1.sql");
      const testFile2 = path.join(BACKUPS_DIR, "backup_test_2.sqlite");
      
      fs.writeFileSync(testFile1, "test postgres backup");
      fs.writeFileSync(testFile2, "test sqlite backup");

      const list = await listBackups();
      // Should find our test backups (filtering starts with backup_ and ends with sql/sqlite)
      const testList = list.filter((b) => b.filename.startsWith("backup_test_"));
      expect(testList.length).toBe(2);
      expect(testList.map((b) => b.filename)).toContain("backup_test_1.sql");
      expect(testList.map((b) => b.filename)).toContain("backup_test_2.sqlite");
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
  });
});
