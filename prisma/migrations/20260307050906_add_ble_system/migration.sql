-- AlterTable
ALTER TABLE "BLESyncLog" ALTER COLUMN "startedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "completedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Room" ALTER COLUMN "lastSyncAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Unit" ALTER COLUMN "lastSyncAt" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "InstitutionMappingSet_createdAt_idx" ON "InstitutionMappingSet"("createdAt");

-- CreateIndex
CREATE INDEX "Unit_departmentId_idx" ON "Unit"("departmentId");
