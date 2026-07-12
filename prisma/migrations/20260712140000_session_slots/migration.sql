-- AlterTable
ALTER TABLE "PhotographerProfile" ADD COLUMN     "sessionDurationMinutes" INTEGER,
ADD COLUMN     "workingHoursStart" TEXT,
ADD COLUMN     "workingHoursEnd" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "eventTime" TEXT;
