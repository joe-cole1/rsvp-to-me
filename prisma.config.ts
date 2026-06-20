import "dotenv/config";
import { defineConfig } from "prisma/config";

const url = process.env.DATABASE_URL || "";
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
