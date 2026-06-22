import "dotenv/config";
import { defineConfig } from "prisma/config";

const rawUrl = process.env.DATABASE_URL || "";
const url = rawUrl.trim().replace(/^["']|["']$/g, "").trim();
const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");

export default defineConfig({
  schema: isPostgres ? "prisma/schema.postgres.prisma" : "prisma/schema.prisma",
  migrations: {
    path: isPostgres ? "prisma/postgres-migrations" : "prisma/migrations",
  },
  datasource: {
    url: url,
  },
});
