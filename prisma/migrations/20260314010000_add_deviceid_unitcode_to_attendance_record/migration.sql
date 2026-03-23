-- Add unitCode (denormalized, for audit records) with empty-string default
ALTER TABLE "OnlineAttendanceRecord"
  ADD COLUMN IF NOT EXISTS "unitCode" TEXT NOT NULL DEFAULT '';

-- Add deviceId (nullable, for audit and rate-limiting)
ALTER TABLE "OnlineAttendanceRecord"
  ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
