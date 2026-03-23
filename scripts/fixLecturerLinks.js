import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixLecturerLinks() {
  const lecturers = await prisma.lecturer.findMany();
  for (const lecturer of lecturers) {
    if (!lecturer.institutionId) {
      console.log(`Lecturer ${lecturer.fullName} (${lecturer.email}) has no institutionId, skipping.`);
      continue;
    }
    const departments = await prisma.department.findMany({
      where: { institutionId: lecturer.institutionId },
    });
    for (const dept of departments) {
      await prisma.lecturerDepartment.upsert({
        where: {
          lecturerId_departmentId: {
            lecturerId: lecturer.id,
            departmentId: dept.id,
          },
        },
        update: {},
        create: { lecturerId: lecturer.id, departmentId: dept.id },
      });
    }
    console.log(`Linked lecturer ${lecturer.fullName} (${lecturer.email}) to all departments in institution.`);
  }
  await prisma.$disconnect();
}

fixLecturerLinks().catch(e => {
  console.error('Fix failed:', e);
  process.exit(1);
});
