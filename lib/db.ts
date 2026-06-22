import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/app/generated/prisma/client";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { PrismaClient as PostgresPrismaClient } from "@/app/generated/prisma-postgres/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const url = rawUrl.trim().replace(/^["']|["']$/g, "").trim();
  const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");

  if (isPostgres) {
    console.log("[db] Initializing PostgreSQL client connection...");
    process.env.DATABASE_URL = url;
    return new (PostgresPrismaClient as unknown as new () => PrismaClient)();
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

