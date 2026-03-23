const { prisma } = require('../dist/lib/prisma');

async function main() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Notification",
      "BookingHold",
      "Booking",
      "PasswordResetToken",
      "Admin",
      "Department",
      "Institution",
      "Room",
      "Course",
      "LecturerAuth",
      "Lecturer",
      "StudentAuth",
      "Student",
      "AttendanceRecord",
      "Enrollment",
      "Timetable",
      "TimetableVersion",
      "Unit",
      "UnitsByCourseYearSemester",
      "UnitsByYearSemester",
      "GroupSubmission"
    RESTART IDENTITY CASCADE;
  `);
  console.log('All data deleted, structure preserved.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
