import { Pool } from "pg";

export default async function globalTeardown() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query(`DELETE FROM "Event" WHERE slug LIKE 'e2e-%'`);
    await pool.query(`DELETE FROM "User" WHERE email LIKE '%@test.internal'`);
  } finally {
    await pool.end();
  }
}
