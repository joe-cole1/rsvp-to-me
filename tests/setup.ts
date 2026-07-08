import dotenv from "dotenv";
import path from "path";

// Load minimum required env vars from .env if present
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || "test-secret-that-is-at-least-32-characters-long";
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Ensure we use the dedicated test database to avoid wiping development data
if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/rsvp_test";
    process.env.DATABASE_URL = url.toString();
  } catch {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/rsvp_test";
  }
} else {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/rsvp_test";
}

process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
