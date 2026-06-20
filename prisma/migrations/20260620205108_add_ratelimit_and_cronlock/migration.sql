-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "points" INTEGER NOT NULL,
    "expireAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CronLock" (
    "jobName" TEXT NOT NULL PRIMARY KEY,
    "lockedAt" DATETIME NOT NULL,
    "expireAt" DATETIME NOT NULL
);
