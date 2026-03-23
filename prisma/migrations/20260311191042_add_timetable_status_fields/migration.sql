-- AlterTable
ALTER TABLE "Timetable" ADD COLUMN     "originalDay" TEXT,
ADD COLUMN     "originalEndTime" TEXT,
ADD COLUMN     "originalStartTime" TEXT,
ADD COLUMN     "pendingReason" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "reschedulePermanent" BOOLEAN,
ADD COLUMN     "rescheduledTo" TEXT,
ADD COLUMN     "updatedBy" TEXT,
ALTER COLUMN "status" SET DEFAULT 'Pending';
