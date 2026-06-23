// Set minimum required env vars for all tests
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/rsvp_test";
process.env.REDIS_URL = "redis://localhost:6379";
