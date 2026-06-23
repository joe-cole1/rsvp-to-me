import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const url = rawUrl.trim().replace(/^["']|["']$/g, "").trim();
  const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");

  if (isPostgres) {
    console.log("[db] Initializing PostgreSQL client connection...");
    process.env.DATABASE_URL = url;
    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    // Lazy-load the Postgres client so SQLite-only environments don't fail on missing generated output
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient: PostgresPrismaClient } = require("@/app/generated/prisma-postgres/client");
    return new (PostgresPrismaClient as unknown as new (options: { adapter: PrismaPg }) => PrismaClient)({ adapter });
  }

  console.log("[db] Initializing SQLite/LibSQL client connection...");
  const libsqlUrl = url.replace(/^file:\/\//, "file:").replace(/^(?!file:|libsql:|https?:)/, "file:");
  const adapter = new PrismaLibSql({ url: libsqlUrl });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

