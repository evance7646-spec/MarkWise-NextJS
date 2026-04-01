-- DropForeignKey
ALTER TABLE "RoomManager" DROP CONSTRAINT "RoomManager_institutionId_fkey";

-- DropIndex
DROP INDEX "TimetableVersion_courseId_idx";

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "allowResub" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowedTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "attemptsAllowed" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "blockLate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isGroup" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ConductedSession" ADD COLUMN     "lessonType" TEXT;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "allowSelfEnroll" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "groupNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxGroupsPerStudent" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "nextMeeting" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "unitCode" TEXT;

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'member';

-- AlterTable
ALTER TABLE "OfflineAttendanceRecord" ADD COLUMN     "admissionNumber" TEXT,
ADD COLUMN     "delegationId" TEXT,
ADD COLUMN     "institutionId" TEXT,
ADD COLUMN     "lessonType" TEXT,
ADD COLUMN     "markedByLecturerId" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "push_token" TEXT;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "submittedByName" TEXT;

-- AlterTable
ALTER TABLE "Timetable" ADD COLUMN     "lessonType" TEXT NOT NULL DEFAULT 'LEC',
ADD COLUMN     "originalVenue" TEXT,
ADD COLUMN     "rescheduledRoomId" TEXT,
ALTER COLUMN "venueName" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MaterialView" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeSpentSeconds" INTEGER,

    CONSTRAINT "MaterialView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPushToken" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "platform" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delegation" (
    "id" TEXT NOT NULL,
    "timetableEntryId" TEXT NOT NULL,
    "institutionId" TEXT,
    "unitCode" TEXT NOT NULL,
    "unitId" INTEGER NOT NULL,
    "roomCode" TEXT NOT NULL,
    "roomId" INTEGER NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupNumber" INTEGER NOT NULL,
    "groupName" TEXT,
    "leaderStudentId" TEXT,
    "validFrom" BIGINT NOT NULL,
    "validUntil" BIGINT NOT NULL,
    "sessionToken" TEXT,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LecturerNotification" (
    "id" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipients" TEXT[],
    "category" TEXT,
    "severity" TEXT,
    "sentBy" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LecturerNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extra_sessions" (
    "id" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "roomCode" TEXT,
    "roomId" TEXT,
    "lessonType" TEXT NOT NULL DEFAULT 'LEC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "extra_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEnrollmentSnapshot" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "unitCodes" TEXT[],
    "unitNamesMap" JSONB NOT NULL DEFAULT '{}',
    "year" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEnrollmentSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenBlocklist" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenBlocklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPoints" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "attendancePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statsJson" JSONB,
    "breakdownJson" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentPoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialView_materialId_idx" ON "MaterialView"("materialId");

-- CreateIndex
CREATE INDEX "MaterialView_studentId_idx" ON "MaterialView"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialView_materialId_studentId_key" ON "MaterialView"("materialId", "studentId");

-- CreateIndex
CREATE INDEX "StudentPushToken_studentId_idx" ON "StudentPushToken"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPushToken_studentId_fcmToken_key" ON "StudentPushToken"("studentId", "fcmToken");

-- CreateIndex
CREATE INDEX "Delegation_leaderStudentId_idx" ON "Delegation"("leaderStudentId");

-- CreateIndex
CREATE INDEX "Delegation_timetableEntryId_idx" ON "Delegation"("timetableEntryId");

-- CreateIndex
CREATE INDEX "Delegation_unitCode_idx" ON "Delegation"("unitCode");

-- CreateIndex
CREATE INDEX "LecturerNotification_lecturerId_idx" ON "LecturerNotification"("lecturerId");

-- CreateIndex
CREATE INDEX "extra_sessions_unitCode_idx" ON "extra_sessions"("unitCode");

-- CreateIndex
CREATE INDEX "extra_sessions_lecturerId_idx" ON "extra_sessions"("lecturerId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollmentSnapshot_studentId_key" ON "StudentEnrollmentSnapshot"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenBlocklist_jti_key" ON "TokenBlocklist"("jti");

-- CreateIndex
CREATE INDEX "TokenBlocklist_expiresAt_idx" ON "TokenBlocklist"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPoints_studentId_key" ON "StudentPoints"("studentId");

-- CreateIndex
CREATE INDEX "StudentPoints_courseId_totalPoints_idx" ON "StudentPoints"("courseId", "totalPoints" DESC);

-- CreateIndex
CREATE INDEX "StudentPoints_institutionId_totalPoints_idx" ON "StudentPoints"("institutionId", "totalPoints" DESC);

-- CreateIndex
CREATE INDEX "Group_unitCode_idx" ON "Group"("unitCode");

-- CreateIndex
CREATE INDEX "OfflineAttendanceRecord_delegationId_idx" ON "OfflineAttendanceRecord"("delegationId");

-- CreateIndex
CREATE INDEX "OfflineAttendanceRecord_markedByLecturerId_idx" ON "OfflineAttendanceRecord"("markedByLecturerId");

-- CreateIndex
CREATE INDEX "RoomManager_institutionId_idx" ON "RoomManager"("institutionId");

-- CreateIndex
CREATE INDEX "Timetable_rescheduledRoomId_idx" ON "Timetable"("rescheduledRoomId");

-- AddForeignKey
ALTER TABLE "MaterialView" ADD CONSTRAINT "MaterialView_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialView" ADD CONSTRAINT "MaterialView_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPushToken" ADD CONSTRAINT "StudentPushToken_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_rescheduledRoomId_fkey" FOREIGN KEY ("rescheduledRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineAttendanceRecord" ADD CONSTRAINT "OfflineAttendanceRecord_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "Delegation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_sessions" ADD CONSTRAINT "extra_sessions_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "Lecturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_sessions" ADD CONSTRAINT "extra_sessions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomManager" ADD CONSTRAINT "RoomManager_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPoints" ADD CONSTRAINT "StudentPoints_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
