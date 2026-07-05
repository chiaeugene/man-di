-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachmentIds" TEXT;

-- CreateTable
CREATE TABLE "PackageAttachment" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "label" TEXT,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackageAttachment_packageId_idx" ON "PackageAttachment"("packageId");

-- CreateIndex
CREATE INDEX "PackageAttachment_profileId_idx" ON "PackageAttachment"("profileId");

-- AddForeignKey
ALTER TABLE "PackageAttachment" ADD CONSTRAINT "PackageAttachment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
