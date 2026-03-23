import { prisma } from '../lib/prisma.js';

async function cleanupNullProgramCourses() {
  // Delete all courses with null programId
  const result = await prisma.$executeRawUnsafe('DELETE FROM "Course" WHERE "programId" IS NULL');
  console.log(`Deleted ${result} orphaned courses with null programId.`);
}

cleanupNullProgramCourses()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
