-- AlterTable: add mergeGroupId to support cross-department merged lessons
ALTER TABLE "Timetable" ADD COLUMN "mergeGroupId" TEXT;

-- Index for fast lookup of all entries in the same merge group
CREATE INDEX "Timetable_mergeGroupId_idx" ON "Timetable"("mergeGroupId");
