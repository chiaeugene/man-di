-- AlterTable
ALTER TABLE "PhotographerProfile" ADD COLUMN     "followUpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "followUpHours" INTEGER,
ADD COLUMN     "followUpMaxCount" INTEGER;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "lastFollowUpAt" TIMESTAMP(3),
ADD COLUMN     "followUpCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_profileId_idx" ON "Campaign"("profileId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PhotographerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
