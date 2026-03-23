-- CreateTable
CREATE TABLE "ConductedSession" (
    "id" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "lectureRoom" TEXT NOT NULL,
    "sessionStart" TIMESTAMP(3) NOT NULL,
    "sessionEnd" TIMESTAMP(3),
    "lecturerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConductedSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineAttendanceRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "lectureRoom" TEXT NOT NULL,
    "sessionStart" TIMESTAMP(3) NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "deviceId" TEXT,
    "rawPayload" TEXT,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OfflineAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConductedSession_unitCode_idx" ON "ConductedSession"("unitCode");
CREATE INDEX "ConductedSession_lecturerId_idx" ON "ConductedSession"("lecturerId");
CREATE UNIQUE INDEX "ConductedSession_unitCode_lectureRoom_sessionStart_key" ON "ConductedSession"("unitCode", "lectureRoom", "sessionStart");
CREATE INDEX "OfflineAttendanceRecord_studentId_idx" ON "OfflineAttendanceRecord"("studentId");
CREATE INDEX "OfflineAttendanceRecord_unitCode_idx" ON "OfflineAttendanceRecord"("unitCode");
CREATE UNIQUE INDEX "OfflineAttendanceRecord_studentId_unitCode_lectureRoom_sess_key" ON "OfflineAttendanceRecord"("studentId", "unitCode", "lectureRoom", "sessionStart");
