import { prisma } from '../lib/prisma.js';

async function cleanupOrphanedRecords() {
  // Delete courses with null programId
  const deletedCourses = await prisma.course.deleteMany({ where: { programId: null } });
  console.log(`Deleted ${deletedCourses.count} orphaned courses.`);

  // Delete year blocks with null programId or null courseId
  const deletedYearBlocks = await prisma.yearBlock.deleteMany({
    where: {
      OR: [
        { programId: null },
        { courseId: null },
      ],
    },
  });
  console.log(`Deleted ${deletedYearBlocks.count} orphaned year blocks.`);

  // Delete semesters with null yearId
  const deletedSemesters = await prisma.semester.deleteMany({ where: { yearId: null } });
  console.log(`Deleted ${deletedSemesters.count} orphaned semesters.`);

  // Delete units with null departmentId
  const deletedUnits = await prisma.unit.deleteMany({ where: { departmentId: null } });
  console.log(`Deleted ${deletedUnits.count} orphaned units.`);
}

cleanupOrphanedRecords()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
