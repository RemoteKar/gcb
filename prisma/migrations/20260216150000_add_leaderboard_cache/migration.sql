-- CreateTable
CREATE TABLE "LeaderboardCache" (
    "id" TEXT NOT NULL DEFAULT 'leaderboard',
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardCache_pkey" PRIMARY KEY ("id")
);
