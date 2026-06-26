import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../app/generated/prisma/client";

export default async function globalTeardown() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // Remove only E2E-specific data by slug/email prefix
    await db.event.deleteMany({ where: { slug: { startsWith: "e2e-" } } });
    await db.user.deleteMany({ where: { email: { endsWith: "@test.internal" } } });
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}
