import { execSync } from "child_process";

export async function setup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL must be set for integration tests");
  }
  execSync("npx prisma generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
}

export async function teardown() {
  // Individual tests manage their own cleanup via truncation helpers
}
