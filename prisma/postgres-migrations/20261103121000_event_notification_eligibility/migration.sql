-- Eligibility for contacts an event did not collect itself: organizer rows record which
-- account contacts the event's old alert switches vouched for (filled by the next
-- migration). RSVP contacts need no snapshot: the event holds them, opt-outs live in the
-- preferences above, and separate copies still require proof of each destination.
ALTER TABLE "NotificationSettings" ADD COLUMN "legacyChannels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
