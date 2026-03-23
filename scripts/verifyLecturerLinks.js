import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyLecturerLinks() {
  const lecturers = await prisma.lecturer.findMany();
  for (const lecturer of lecturers) {
    const departments = await prisma.department.findMany({
      where: { institutionId: lecturer.institutionId },
    });
    const links = await prisma.lecturerDepartment.findMany({
      where: { lecturerId: lecturer.id },
    });
    const linkedDeptIds = new Set(links.map(l => l.departmentId));
    const missing = departments.filter(dept => !linkedDeptIds.has(dept.id));
    if (missing.length === 0) {
      console.log(`Lecturer ${lecturer.fullName} (${lecturer.email}) is linked to all departments in institution.`);
    } else {
      console.log(`Lecturer ${lecturer.fullName} (${lecturer.email}) is missing links to departments:`, missing.map(d => d.name));
    }
  }
  await prisma.$disconnect();
}

verifyLecturerLinks().catch(e => {
  console.error('Verification failed:', e);
  process.exit(1);
});
