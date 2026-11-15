CREATE TABLE "Upload" (
    "filename" TEXT NOT NULL,
    "ownerId" TEXT,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Upload_pkey" PRIMARY KEY ("filename")
);

CREATE INDEX "Upload_ownerId_idx" ON "Upload"("ownerId");
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
