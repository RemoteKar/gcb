-- CreateTable
CREATE TABLE "CharacterComment" (
    "id" SERIAL NOT NULL,
    "characterId" INTEGER NOT NULL,
    "nickname" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "ipPrefix" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CharacterComment_characterId_createdAt_idx" ON "CharacterComment"("characterId", "createdAt");
