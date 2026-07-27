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
  execSync("npx prisma db push", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
  execSync(
    `node -e "const { Client } = require('pg'); const client = new Client({ connectionString: process.env.DATABASE_URL }); client.connect().then(() => client.query('CREATE TABLE IF NOT EXISTS _prisma_migrations (id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL, finished_at TIMESTAMPTZ, migration_name VARCHAR(255) NOT NULL, logs TEXT, rolled_back_at TIMESTAMPTZ, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), applied_steps_count INT NOT NULL DEFAULT 0);')).then(() => client.end());"`,
    {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: dbUrl },
    }
  );
}

export async function teardown() {
  // Individual tests manage their own cleanup via truncation helpers
}
