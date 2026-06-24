import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const pending = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM _prisma_migrations
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
    `;

    if (Number(pending[0]?.count ?? 0) > 0) {
      return NextResponse.json(
        { status: "degraded", migrations: "pending" },
        { status: 503 }
      );
    }
  } catch {
    // If the migrations table itself is unreachable we cannot assert health.
    return NextResponse.json(
      { status: "degraded", migrations: "unreachable" },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: "ok",
    migrations: "ok",
    timestamp: new Date().toISOString(),
  });
}
