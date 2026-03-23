-- Add BLE metadata columns
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "bleMetadata" JSONB DEFAULT '{}';
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "syncVersion" INTEGER DEFAULT 0;

ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "bleMetadata" JSONB DEFAULT '{}';
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP;
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "syncVersion" INTEGER DEFAULT 0;

-- Create BLE sync log table
CREATE TABLE IF NOT EXISTS "BLESyncLog" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "unitsSynced" INTEGER,
    "roomsSynced" INTEGER,
    "errors" JSONB,
    "startedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP,
    "triggeredBy" TEXT,
    "deviceInfo" JSONB,
    PRIMARY KEY ("id")
);

CREATE INDEX "BLESyncLog_institutionId_idx" ON "BLESyncLog"("institutionId");
CREATE INDEX "BLESyncLog_startedAt_idx" ON "BLESyncLog"("startedAt");

-- Add indexes for performance
CREATE INDEX "Unit_bleId_idx" ON "Unit"("bleId");
CREATE INDEX "Room_bleId_idx" ON "Room"("bleId");

-- Update InstitutionMappingSet
ALTER TABLE "InstitutionMappingSet" ADD COLUMN IF NOT EXISTS "checksum" TEXT;
ALTER TABLE "InstitutionMappingSet" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';

-- Run initial ID assignment (will be done by script)