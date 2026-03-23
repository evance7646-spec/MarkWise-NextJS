import { prisma } from '../lib/prisma.js'; // Correct path for scripts/seedProgramsAndYears.ts if lib/prisma.ts exists

async function seedProgramsAndYears() {
  // Get all courses
  const courses = await prisma.course.findMany({
    select: { id: true, name: true, departmentId: true, programId: true }
  });

  for (const course of courses) {
    // Find or create program
    let program = await prisma.program.findFirst({
      where: { courses: { some: { id: course.id } } },
      include: { years: true }
    });
    if (!program) {
      program = await prisma.program.create({
        data: {
          name: `${course.name} Program`,
          durationYears: 3, // Default duration, adjust as needed
          departmentId: course.departmentId,
          courses: { connect: { id: course.id } },
        },
        include: { years: true }
      });
      await prisma.course.update({
        where: { id: course.id },
        data: { programId: program.id },
      });
    }
    // If program has no years, create them
    if (!program.years || program.years.length === 0) {
      const yearsToCreate = 3; // Default, adjust as needed
      for (let i = 1; i <= yearsToCreate; i++) {
        await prisma.yearBlock.create({
          data: {
            name: `Year ${i}`,
            programId: program.id,
          },
        });
      }
    }
  }
  console.log('Seeding complete!');
}

seedProgramsAndYears()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
