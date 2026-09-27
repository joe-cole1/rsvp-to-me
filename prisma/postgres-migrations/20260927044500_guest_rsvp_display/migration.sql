-- Preserve existing events' appearance, then set softer defaults for new events.
BEGIN;

CREATE TYPE "GuestListDisplay" AS ENUM ('EXPANDED', 'COLLAPSED', 'HIDDEN');
CREATE TYPE "GuestCountDisplay" AS ENUM ('EXACT', 'CAPPED', 'HIDDEN');

ALTER TABLE "Event"
  ADD COLUMN "guestGoingList" "GuestListDisplay" NOT NULL DEFAULT 'EXPANDED',
  ADD COLUMN "guestGoingCount" "GuestCountDisplay" NOT NULL DEFAULT 'EXACT',
  ADD COLUMN "guestMaybeList" "GuestListDisplay" NOT NULL DEFAULT 'EXPANDED',
  ADD COLUMN "guestMaybeCount" "GuestCountDisplay" NOT NULL DEFAULT 'EXACT',
  ADD COLUMN "guestDeclinedList" "GuestListDisplay" NOT NULL DEFAULT 'EXPANDED',
  ADD COLUMN "guestDeclinedCount" "GuestCountDisplay" NOT NULL DEFAULT 'EXACT';

ALTER TABLE "Event"
  ALTER COLUMN "guestDeclinedList" SET DEFAULT 'COLLAPSED',
  ALTER COLUMN "guestDeclinedCount" SET DEFAULT 'HIDDEN';

COMMIT;
