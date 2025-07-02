-- CreateTable
CREATE TABLE "BadgeData" (
    "uuid" TEXT NOT NULL,
    "badgeData" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "BadgeData_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "BadgeData_uuid_key" ON "BadgeData"("uuid");
