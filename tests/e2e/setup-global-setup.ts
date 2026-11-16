import { Pool } from "pg";
import { startEmailFixture } from "./email-fixture";

export default async function setup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    return await startEmailFixture(pool);
  } finally {
    await pool.end();
  }
}
