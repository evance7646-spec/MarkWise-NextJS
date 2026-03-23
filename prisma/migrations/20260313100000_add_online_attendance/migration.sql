CREATE TABLE "OnlineAttendanceSession" (
  "id"         TEXT NOT NULL,
  "lecturerId" TEXT NOT NULL,
  "unitCode"   TEXT NOT NULL,
  "type"       TEXT NOT NULL DEFAULT 'online',
  "status"     TEXT NOT NULL DEFAULT 'active',
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "endedAt"    TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnlineAttendanceSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnlineAttendanceRecord" (
  "id"              TEXT NOT NULL,
  "sessionId"       TEXT NOT NULL,
  "studentId"       TEXT NOT NULL,
  "admissionNumber" TEXT NOT NULL,
  "markedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnlineAttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OnlineAttendanceSession_lecturerId_idx" ON "OnlineAttendanceSession"("lecturerId");
CREATE INDEX "OnlineAttendanceSession_status_idx" ON "OnlineAttendanceSession"("status");
CREATE UNIQUE INDEX "OnlineAttendanceRecord_sessionId_studentId_key" ON "OnlineAttendanceRecord"("sessionId", "studentId");
CREATE INDEX "OnlineAttendanceRecord_sessionId_idx" ON "OnlineAttendanceRecord"("sessionId");

ALTER TABLE "OnlineAttendanceRecord"
  ADD CONSTRAINT "OnlineAttendanceRecord_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "OnlineAttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
