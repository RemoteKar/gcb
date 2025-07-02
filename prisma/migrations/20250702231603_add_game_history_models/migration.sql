-- CreateTable
CREATE TABLE "GameRecord" (
    "fileName" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "GameRecord_pkey" PRIMARY KEY ("fileName")
);

-- CreateTable
CREATE TABLE "UserGameHistoryCache" (
    "uuid" TEXT NOT NULL,
    "gameRecords" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UserGameHistoryCache_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameRecord_fileName_key" ON "GameRecord"("fileName");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameHistoryCache_uuid_key" ON "UserGameHistoryCache"("uuid");
