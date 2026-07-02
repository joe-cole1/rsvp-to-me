import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

/**
 * SEC-31: anonymous callers get a minimal liveness signal only (200/503 with a
 * bare status). The detailed body (migration state, timestamp) is reserved for
 * internal callers that present the operator-configured HEALTH_CHECK_TOKEN in
 * the x-health-token header. When the env var is unset, every caller is
 * treated as anonymous.
 */
function isInternalCaller(request: Request): boolean {
  const expected = process.env.HEALTH_CHECK_TOKEN;
  if (!expected) return false;
  const provided = request.headers.get("x-health-token");
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  let migrations: "ok" | "pending" | "unreachable" = "ok";
  try {
    const pending = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM _prisma_migrations
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
    `;
    if (Number(pending[0]?.count ?? 0) > 0) migrations = "pending";
  } catch {
    // If the migrations table itself is unreachable we cannot assert health.
    migrations = "unreachable";
  }

  const healthy = migrations === "ok";
  const status = healthy ? 200 : 503;

  if (!isInternalCaller(request)) {
    return NextResponse.json({ status: healthy ? "ok" : "unavailable" }, { status });
  }

  return NextResponse.json(
    healthy
      ? { status: "ok", migrations, timestamp: new Date().toISOString() }
      : { status: "degraded", migrations },
    { status }
  );
}
