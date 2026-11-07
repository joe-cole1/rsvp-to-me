-- Issue #825: effects can be a mixture of up to three local library icons, and
-- movement (up, down or random) is chosen independently of the motif.
-- Additive only: existing effect sets, amounts, speeds and sizes are untouched.
-- A null movement keeps each built-in set's own fall/float direction.
ALTER TABLE "EventTheme"
  ADD COLUMN "effectIconIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "effectMovement" TEXT;
