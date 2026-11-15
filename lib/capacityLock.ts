import { db } from "./db";
import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Serialize guest RSVP rule checks and writes for an event in PostgreSQL.
 * Every query in the critical section must use the supplied transaction client.
 * A failed acquisition/transaction fails closed; Redis outages and lock expiry
 * cannot permit an unlocked capacity write.
 */
export async function withEventCapacityLock<T>(
  eventId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`rsvp-cap:${eventId}`}, 0))`;
      return fn(tx);
    },
    { maxWait: 10000, timeout: 15000 }
  );
}
