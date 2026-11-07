-- Issue #811: guest RSVP display gains an Invited row, and counts no longer
-- depend on names. Both changes keep every existing event looking the same.
BEGIN;

-- Invited (host-added guests with no reply yet) stays hidden from guests unless
-- the host turns it on.
ALTER TABLE "Event"
  ADD COLUMN "guestInvitedList" "GuestListDisplay" NOT NULL DEFAULT 'HIDDEN',
  ADD COLUMN "guestInvitedCount" "GuestCountDisplay" NOT NULL DEFAULT 'HIDDEN';

-- Hidden names used to hide the count too. Now a count can show on its own, so
-- hide the stored count wherever names were hidden to keep today's guest view.
UPDATE "Event" SET "guestGoingCount" = 'HIDDEN' WHERE "guestGoingList" = 'HIDDEN';
UPDATE "Event" SET "guestMaybeCount" = 'HIDDEN' WHERE "guestMaybeList" = 'HIDDEN';
UPDATE "Event" SET "guestDeclinedCount" = 'HIDDEN' WHERE "guestDeclinedList" = 'HIDDEN';

COMMIT;
