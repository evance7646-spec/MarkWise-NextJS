-- Add missing indexes for foreign key columns to improve query performance

-- GroupMember
CREATE INDEX IF NOT EXISTS "GroupMember_groupId_idx" ON "GroupMember"("groupId");
CREATE INDEX IF NOT EXISTS "GroupMember_studentId_idx" ON "GroupMember"("studentId");

-- Assignment
CREATE INDEX IF NOT EXISTS "Assignment_unitId_idx" ON "Assignment"("unitId");
CREATE INDEX IF NOT EXISTS "Assignment_lecturerId_idx" ON "Assignment"("lecturerId");

-- Submission
CREATE INDEX IF NOT EXISTS "Submission_assignmentId_idx" ON "Submission"("assignmentId");
CREATE INDEX IF NOT EXISTS "Submission_studentId_idx" ON "Submission"("studentId");

-- Material (lecturerId)
CREATE INDEX IF NOT EXISTS "Material_lecturerId_idx" ON "Material"("lecturerId");

-- Department (institutionId)
CREATE INDEX IF NOT EXISTS "Department_institutionId_idx" ON "Department"("institutionId");

-- Program
CREATE INDEX IF NOT EXISTS "Program_departmentId_idx" ON "Program"("departmentId");

-- Course
CREATE INDEX IF NOT EXISTS "Course_departmentId_idx" ON "Course"("departmentId");
CREATE INDEX IF NOT EXISTS "Course_programId_idx" ON "Course"("programId");

-- YearBlock
CREATE INDEX IF NOT EXISTS "YearBlock_courseId_idx" ON "YearBlock"("courseId");
CREATE INDEX IF NOT EXISTS "YearBlock_programId_idx" ON "YearBlock"("programId");

-- Semester
CREATE INDEX IF NOT EXISTS "Semester_yearId_idx" ON "Semester"("yearId");

-- Admin
CREATE INDEX IF NOT EXISTS "Admin_institutionId_idx" ON "Admin"("institutionId");
CREATE INDEX IF NOT EXISTS "Admin_departmentId_idx" ON "Admin"("departmentId");

-- Lecturer
CREATE INDEX IF NOT EXISTS "Lecturer_institutionId_idx" ON "Lecturer"("institutionId");

-- Student (courseId, departmentId)
CREATE INDEX IF NOT EXISTS "Student_courseId_idx" ON "Student"("courseId");
CREATE INDEX IF NOT EXISTS "Student_departmentId_idx" ON "Student"("departmentId");

-- Booking
CREATE INDEX IF NOT EXISTS "Booking_roomId_idx" ON "Booking"("roomId");
CREATE INDEX IF NOT EXISTS "Booking_lecturerId_idx" ON "Booking"("lecturerId");
CREATE INDEX IF NOT EXISTS "Booking_roomId_startAt_endAt_idx" ON "Booking"("roomId", "startAt", "endAt");

-- BookingHold
CREATE INDEX IF NOT EXISTS "BookingHold_roomId_idx" ON "BookingHold"("roomId");
CREATE INDEX IF NOT EXISTS "BookingHold_roomId_status_idx" ON "BookingHold"("roomId", "status");

-- AttendanceRecord
CREATE INDEX IF NOT EXISTS "AttendanceRecord_studentId_idx" ON "AttendanceRecord"("studentId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_roomId_idx" ON "AttendanceRecord"("roomId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_studentId_date_idx" ON "AttendanceRecord"("studentId", "date");

-- TimetableVersion
CREATE INDEX IF NOT EXISTS "TimetableVersion_courseId_idx" ON "TimetableVersion"("courseId");

-- Notification
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- PasswordResetToken
CREATE INDEX IF NOT EXISTS "PasswordResetToken_adminId_idx" ON "PasswordResetToken"("adminId");

-- OnlineAttendanceRecord (studentId)
CREATE INDEX IF NOT EXISTS "OnlineAttendanceRecord_studentId_idx" ON "OnlineAttendanceRecord"("studentId");

-- Timetable (compound indexes for conflict checks)
CREATE INDEX IF NOT EXISTS "Timetable_day_roomId_idx" ON "Timetable"("day", "roomId");
CREATE INDEX IF NOT EXISTS "Timetable_day_lecturerId_idx" ON "Timetable"("day", "lecturerId");
