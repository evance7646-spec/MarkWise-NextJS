-- Normalise session_start to whole-second precision in ConductedSession
UPDATE "ConductedSession"
SET "sessionStart" = to_timestamp(FLOOR(EXTRACT(EPOCH FROM "sessionStart")))
WHERE EXTRACT(MILLISECONDS FROM "sessionStart") % 1000 != 0;

-- Same for OfflineAttendanceRecord
UPDATE "OfflineAttendanceRecord"
SET "sessionStart" = to_timestamp(FLOOR(EXTRACT(EPOCH FROM "sessionStart")))
WHERE EXTRACT(MILLISECONDS FROM "sessionStart") % 1000 != 0;
