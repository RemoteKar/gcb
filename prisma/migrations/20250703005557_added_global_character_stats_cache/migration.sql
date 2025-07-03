-- CreateTable
CREATE TABLE "GlobalCharacterStatsCache" (
    "cacheKey" TEXT NOT NULL,
    "statsData" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "GlobalCharacterStatsCache_pkey" PRIMARY KEY ("cacheKey")
);
