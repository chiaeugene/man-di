-- CreateTable
CREATE TABLE "InboundAttachment" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboundAttachment_profileId_idx" ON "InboundAttachment"("profileId");

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "inboundAttachmentIds" TEXT;
