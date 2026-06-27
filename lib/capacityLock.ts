import { isRedisEnabled, redisAcquireLock, redisReleaseLock } from "./redis";

// SEC-12 / SEC-21(b): serialize the capacity check-then-write for a single event
// so two concurrent GOING submissions can't both read a stale `count()` before
// either row is written (which would overbook the event). Redis is a hard
// requirement in production; the per-event lock mirrors the cron sync-lock
// pattern already in use (`redisAcquireLock`/`redisReleaseLock`).
//
// Acquisition is retried with a short backoff so simultaneous *legitimate* RSVPs
// queue behind one another rather than being rejected. If Redis is genuinely
// unavailable we fall back to running without the lock rather than blocking
// RSVPs outright — the same degraded-mode posture `rateLimit()` takes.

const LOCK_TTL_SECONDS = 10;
const MAX_ACQUIRE_ATTEMPTS = 25;
const ACQUIRE_BACKOFF_MS = 40;

export async function withEventCapacityLock<T>(eventId: string, fn: () => Promise<T>): Promise<T> {
  if (!isRedisEnabled()) return fn();

  const lockKey = `rsvp-cap:${eventId}`;
  let acquired = false;
  for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt++) {
    acquired = await redisAcquireLock(lockKey, LOCK_TTL_SECONDS);
    if (acquired) break;
    await new Promise((resolve) => setTimeout(resolve, ACQUIRE_BACKOFF_MS));
  }

  try {
    return await fn();
  } finally {
    if (acquired) await redisReleaseLock(lockKey);
  }
}
