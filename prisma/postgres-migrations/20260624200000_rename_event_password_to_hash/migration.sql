-- Rename plaintext password column to passwordHash and clear existing values.
-- There is no safe upgrade path from plaintext to hash without the original secret,
-- so any events with a password set will require the host to re-enter it after deploy.
ALTER TABLE "Event" RENAME COLUMN "password" TO "passwordHash";
UPDATE "Event" SET "passwordHash" = NULL WHERE "passwordHash" IS NOT NULL;
