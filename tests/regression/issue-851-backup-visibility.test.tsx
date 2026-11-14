// @vitest-environment jsdom
// #851: pre-migration snapshots were invisible to operators. Show recovery
// metadata while keeping sensitive snapshots outside browser management.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@/tests/components/render";
import { BackupsTab } from "@/app/(app)/admin/tabs/BackupsTab";

afterEach(cleanup);
describe("#851 migration backup visibility", () => {
  it("shows snapshot type, date and size without download/delete controls", () => {
    render(
      <BackupsTab
        handleSaveBackupConfig={vi.fn()}
        backupSchedule="disabled"
        setBackupSchedule={vi.fn()}
        backupKeepCount={7}
        setBackupKeepCount={vi.fn()}
        lastBackupTime=""
        isSavingBackupConfig={false}
        handleCreateBackup={vi.fn()}
        isBackupRunning={false}
        handleDeleteBackup={vi.fn()}
        backups={[
          { filename: "backup_normal.sql", sizeBytes: 2048, createdAt: new Date("2026-01-01Z") },
          {
            filename: "pre-migration/schema.sql",
            sizeBytes: 1024,
            createdAt: new Date("2026-01-01Z"),
            kind: "schema",
          },
          {
            filename: "pre-migration/secret.sql",
            sizeBytes: 4096,
            createdAt: new Date("2026-01-01Z"),
            kind: "recovery",
          },
        ]}
      />
    );
    for (const [name, label, size] of [
      ["schema.sql", "Startup snapshot · read-only", "1.00 KB"],
      ["secret.sql", "Secret recovery · read-only", "4.00 KB"],
    ]) {
      const row = screen.getByText(`pre-migration/${name}`).closest("tr")!;
      expect(within(row).getByText(label)).toBeTruthy();
      expect(within(row).getByText(size)).toBeTruthy();
      expect(within(row).queryAllByRole("link")).toHaveLength(0);
      expect(within(row).queryAllByRole("button")).toHaveLength(0);
    }
    const normal = screen.getByText("backup_normal.sql").closest("tr")!;
    expect(within(normal).getByRole("link", { name: "Download" }).getAttribute("href")).toBe(
      "/api/admin/backups/backup_normal.sql"
    );
    expect(within(normal).getByRole("button", { name: "Delete" })).toBeTruthy();
    expect(screen.getByText(/Protect them as secrets/)).toBeTruthy();
  });
});
