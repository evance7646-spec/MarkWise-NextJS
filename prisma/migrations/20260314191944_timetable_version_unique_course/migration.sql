/*
  Warnings:

  - A unique constraint covering the columns `[courseId]` on the table `TimetableVersion` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex (if exists)
DROP INDEX IF EXISTS "Timetable_mergeGroupId_idx";

-- DropIndex (if exists)
DROP INDEX IF EXISTS "TimetableVersion_courseId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "TimetableVersion_courseId_key" ON "TimetableVersion"("courseId");
