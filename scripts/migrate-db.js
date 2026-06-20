/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("child_process");

function main() {
  const url = process.env.DATABASE_URL || "";
  console.log(`[migrate-db] Active DATABASE_URL: ${url ? url.split("@")[1] || url : "not set"}`);

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    console.log("[migrate-db] PostgreSQL database detected. Running prisma db push...");
    try {
      execSync(
        "npx prisma db push --schema=prisma/schema.postgres.prisma --accept-data-loss --skip-generate",
        { stdio: "inherit" }
      );
      console.log("[migrate-db] PostgreSQL schema push completed successfully.");
    } catch (error) {
      console.error("[migrate-db] PostgreSQL schema push failed:", error);
      process.exit(1);
    }
  } else {
    console.log("[migrate-db] SQLite database detected. Running prisma migrate deploy...");
    try {
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      console.log("[migrate-db] SQLite migrations applied successfully.");
    } catch (error) {
      console.error("[migrate-db] SQLite migrations failed:", error);
      process.exit(1);
    }
  }
}

main();
