-- CreateIndex
CREATE UNIQUE INDEX "OnlineAttendanceRecord_sessionId_deviceId_key" ON "OnlineAttendanceRecord"("sessionId", "deviceId");
