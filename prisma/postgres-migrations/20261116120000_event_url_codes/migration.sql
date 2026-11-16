-- Existing addresses stay unchanged. Only newly generated links gain provenance.
ALTER TABLE "Event" ADD COLUMN "slugRandomCode" TEXT;
