/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config();
const { execSync } = require("child_process");

function main() {
  const rawUrl = process.env.DATABASE_URL || "";
  const url = rawUrl.trim().replace(/^["']|["']$/g, "").trim();
  console.log("[migrate-db] Active DATABASE_URL: %s", url ? url.split("@")[1] || url : "not set");

  try {
    console.log("[migrate-db] Deploying database migrations...");
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
    console.log("[migrate-db] Database migrations deployed successfully.");
  } catch (error) {
    console.error("[migrate-db] Database migration deployment failed:", error);
    process.exit(1);
  }
}

main();
