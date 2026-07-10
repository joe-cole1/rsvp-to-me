-- CreateTable
CREATE TABLE "CoHostInvitation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoHostInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoHostInvitation_token_key" ON "CoHostInvitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CoHostInvitation_eventId_email_key" ON "CoHostInvitation"("eventId", "email");

-- AddForeignKey
ALTER TABLE "CoHostInvitation" ADD CONSTRAINT "CoHostInvitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
