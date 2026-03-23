import { prisma } from '../lib/prisma.js';

async function deleteSeededProgramsAndYears() {
  // Delete all YearBlocks
  await prisma.yearBlock.deleteMany({});
  // Delete all Programs
  await prisma.program.deleteMany({});
  // Optionally, unset programId from all courses
  await prisma.course.updateMany({ data: { programId: null } });
  console.log('Deleted all programs and years, and unset programId from courses.');
}

deleteSeededProgramsAndYears()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
