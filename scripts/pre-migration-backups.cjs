/* eslint-disable @typescript-eslint/no-require-imports */
// Startup cannot depend on SystemConfig before schema/secret migrations finish.
// Keep recovery snapshots independent of routine startup churn, with one fixed
// limit and no new operator settings. Legacy unclassified dumps are recovery.
const fs = require("node:fs");
const path = require("node:path");
const KEEP_COUNT = 7;
const SNAPSHOT_NAME =
  /^pre-migration(?:-(schema|secrets))?_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(?:_[0-9a-f-]{36})?\.sql$/;

// Direct constants keep Next's file tracer confined to runtime backup storage.
const DATA_DIR = path.join(process.cwd(), "data");
const BACKUPS_DIR = path.join(process.cwd(), "data", "backups");
const SNAPSHOTS_DIR = path.join(process.cwd(), "data", "backups", "pre-migration");

function snapshotDirectory(create = false) {
  if (create && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { mode: 0o700 });
  if (!fs.lstatSync(DATA_DIR).isDirectory()) throw new Error("Unsafe backup directory");
  if (create && !fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { mode: 0o700 });
  if (!fs.lstatSync(BACKUPS_DIR).isDirectory()) throw new Error("Unsafe backup directory");
  if (create && !fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { mode: 0o700 });
  if (!fs.lstatSync(SNAPSHOTS_DIR).isDirectory()) throw new Error("Unsafe backup directory");
  // lstat does not follow symlinks; symlink entries are not directories.
  return SNAPSHOTS_DIR;
}

function listPreMigrationBackups() {
  try {
    snapshotDirectory();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return fs
    .readdirSync(SNAPSHOTS_DIR)
    .flatMap((filename) => {
      const match = SNAPSHOT_NAME.exec(filename);
      if (!match) return [];
      try {
        const stat = fs.lstatSync(path.join(SNAPSHOTS_DIR, filename));
        if (!stat.isFile() || stat.isSymbolicLink()) return [];
        return [
          {
            filename,
            sizeBytes: stat.size,
            createdAt: stat.mtime,
            kind: match[1] === "schema" ? "schema" : "recovery",
          },
        ];
      } catch (error) {
        if (error.code === "ENOENT") return []; // Concurrent rotation.
        throw error;
      }
    })
    .sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() || b.filename.localeCompare(a.filename)
    );
}

function rotatePreMigrationBackups(completedFilename) {
  snapshotDirectory();
  const snapshots = listPreMigrationBackups();
  // Only a completed, regular replacement permits pruning. Always retain it,
  // even if an old snapshot has a future mtime (e.g. after a restore).
  if (!snapshots.some((snapshot) => snapshot.filename === completedFilename)) {
    throw new Error("Completed backup missing; retention skipped");
  }
  for (const kind of ["schema", "recovery"]) {
    const pool = snapshots.filter((snapshot) => snapshot.kind === kind);
    pool.sort(
      (a, b) => Number(b.filename === completedFilename) - Number(a.filename === completedFilename)
    );
    for (const snapshot of pool.slice(KEEP_COUNT)) {
      try {
        fs.unlinkSync(path.join(SNAPSHOTS_DIR, snapshot.filename));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
}

module.exports = {
  KEEP_COUNT,
  snapshotDirectory,
  listPreMigrationBackups,
  rotatePreMigrationBackups,
};
