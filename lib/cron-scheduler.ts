import cron from "node-cron";
import { processReminders } from "./reminders";
import { runBackup } from "./backup";
import { db } from "./db";
import { isRedisEnabled, redisAcquireLock, redisReleaseLock } from "./redis";
import { logSafe } from "./logger";
import { performImmediateUserDeletion } from "./account-deletion";
import { cleanupRateLimits } from "./rateLimit";

async function runWithLock(
  jobName: string,
  lockDurationSeconds: number,
  fn: () => Promise<void>
): Promise<void> {
  const now = new Date();
  const expireAt = new Date(now.getTime() + lockDurationSeconds * 1000);
  const lockKey = `lock:cron:${jobName}`;

  let hasRedisLock = false;

  if (isRedisEnabled()) {
    const acquired = await redisAcquireLock(lockKey, lockDurationSeconds);
    if (!acquired) {
      console.log(
        `[cron-scheduler] Failed to acquire Redis lock for job "${jobName}" (another instance is running). Skipping.`
      );
      return;
    }
    hasRedisLock = true;
  } else {
    // Clean up stale database locks
    await db.cronLock
      .deleteMany({
        where: { expireAt: { lt: now } },
      })
      .catch(logSafe(`cron:${jobName}:stale-db-lock-cleanup`));

    try {
      await db.cronLock.create({
        data: { jobName, lockedAt: now, expireAt },
      });
    } catch {
      console.log(
        `[cron-scheduler] Failed to acquire database lock for job "${jobName}" (another instance is running). Skipping.`
      );
      return;
    }
  }

  try {
    await fn();
  } finally {
    if (hasRedisLock) {
      await redisReleaseLock(lockKey).catch(logSafe(`cron:release-redis-lock:${jobName}`));
    } else {
      await db.cronLock
        .delete({ where: { jobName } })
        .catch(logSafe(`cron:release-db-lock:${jobName}`));
    }
  }
}

async function processExpiredDeletions() {
  await runWithLock("process_expired_deletions", 600, async () => {
    const now = new Date();
    const pending = await db.user.findMany({
      where: { deletionScheduledAt: { lte: now, not: null } },
      select: { id: true, name: true, email: true },
    });

    if (pending.length === 0) return;
    console.log(`[cron-scheduler] Processing ${pending.length} expired account deletion(s)...`);

    for (const user of pending) {
      const upcomingEvents = await db.event.count({
        where: { hostId: user.id, status: "PUBLISHED", startAt: { gt: now } },
      });

      if (upcomingEvents > 0) {
        console.warn(
          `[cron-scheduler] Skipping deletion for user ${user.id} — still has ${upcomingEvents} upcoming published event(s).`
        );
        continue;
      }

      await performImmediateUserDeletion(user.id);

      console.log(
        `[cron-scheduler] Anonymized account for user ${user.id} (was: ${user.email ?? user.name}).`
      );
    }
  });
}

async function processRateLimitCleanup() {
  await runWithLock("process_rate_limit_cleanup", 600, async () => {
    console.log("[cron-scheduler] Running rate limit database cleanup...");
    await cleanupRateLimits();
  });
}

console.log("[cron-scheduler] Module loaded");

const activeTasks: ReturnType<typeof cron.schedule>[] = [];
let currentBackupSchedule = "";
let backupTask: ReturnType<typeof cron.schedule> | null = null;

export function stopInProcessCron() {
  for (const task of activeTasks) {
    task.stop();
  }
  activeTasks.length = 0;
  if (backupTask) {
    backupTask.stop();
    backupTask = null;
  }
  console.log("[cron-scheduler] All scheduled tasks stopped.");
}

async function syncBackupJob() {
  let schedule = process.env.BACKUP_SCHEDULE || "";

  try {
    const config = await db.systemConfig.findUnique({
      where: { key: "backup_schedule" },
    });
    if (config?.value) {
      schedule = config.value.trim();
    }
  } catch {
    // Fail silently (e.g. during initial DB schema load)
  }

  if (schedule !== currentBackupSchedule) {
    if (backupTask) {
      console.log("[cron-scheduler] Stopping existing database backup task...");
      backupTask.stop();
      backupTask = null;
    }

    currentBackupSchedule = schedule;

    if (schedule && schedule !== "disabled" && schedule !== "false") {
      console.log('[cron-scheduler] Scheduling database backup job with pattern: "%s"', schedule);
      try {
        if (cron.validate(schedule)) {
          backupTask = cron.schedule(schedule, () => {
            console.log("[cron-scheduler] Starting scheduled database backup...");
            runWithLock("run_backup", 600, async () => {
              await runBackup();
            }).catch((err) =>
              console.error("[cron-scheduler] Scheduled database backup failed:", err)
            );
          });
        } else {
          console.error('[cron-scheduler] Invalid database backup cron pattern: "%s"', schedule);
        }
      } catch (err) {
        console.error("[cron-scheduler] Failed to schedule database backup cron:", err);
      }
    } else {
      console.log("[cron-scheduler] Automated database backups are disabled.");
    }
  }
}

export async function startInProcessCron() {
  console.log("[cron-scheduler] In-process reminder & backup scheduler starting...");

  // Run reminders immediately on startup
  processReminders().catch((err) =>
    console.error("[cron-scheduler] Startup reminders check failed:", err)
  );

  // Schedule reminders check every 15 minutes
  activeTasks.push(
    cron.schedule("*/15 * * * *", () => {
      processReminders().catch((err) =>
        console.error("[cron-scheduler] Reminders check failed:", err)
      );
    })
  );

  // Run account deletion processing on startup and once daily
  processExpiredDeletions().catch((err) =>
    console.error("[cron-scheduler] Startup account deletion check failed:", err)
  );
  activeTasks.push(
    cron.schedule("0 0 * * *", () => {
      processExpiredDeletions().catch((err) =>
        console.error("[cron-scheduler] Account deletion processing failed:", err)
      );
    })
  );

  // Run rate limit database cleanup on startup and once daily (at 1:00 AM)
  processRateLimitCleanup().catch((err) =>
    console.error("[cron-scheduler] Startup rate limit cleanup failed:", err)
  );
  activeTasks.push(
    cron.schedule("0 1 * * *", () => {
      processRateLimitCleanup().catch((err) =>
        console.error("[cron-scheduler] Daily rate limit cleanup failed:", err)
      );
    })
  );

  // Initial backup schedule sync
  await syncBackupJob().catch((err) =>
    console.error("[cron-scheduler] Initial backup sync failed:", err)
  );

  // Sync backup schedule config every 5 minutes
  activeTasks.push(
    cron.schedule("*/5 * * * *", () => {
      syncBackupJob().catch((err) =>
        console.error("[cron-scheduler] Sync backup job failed:", err)
      );
    })
  );
}
