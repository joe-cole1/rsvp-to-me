-- AlterTable
ALTER TABLE "MagicToken" ADD COLUMN     "codeAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "codeHash" TEXT;

-- CreateIndex
CREATE INDEX "MagicToken_userId_type_used_expiresAt_idx" ON "MagicToken"("userId", "type", "used", "expiresAt");
