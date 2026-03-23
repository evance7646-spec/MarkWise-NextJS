CREATE TABLE "MeetingInvite" (
  "id"           TEXT NOT NULL,
  "lecturerId"   TEXT NOT NULL,
  "lecturerName" TEXT NOT NULL,
  "unitCode"     TEXT NOT NULL,
  "unitName"     TEXT NOT NULL,
  "meetingLink"  TEXT NOT NULL,
  "passcode"     TEXT,
  "scheduledAt"  TIMESTAMP(3) NOT NULL,
  "message"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingInvite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MeetingInvite_unitCode_scheduledAt_idx" ON "MeetingInvite"("unitCode", "scheduledAt");
