// Run this script with: npx ts-node scripts/seedTestLecturer.ts

let prisma;
async function getPrisma() {
  if (!prisma) {
    prisma = (await import('../lib/prisma.ts')).prisma;
  }
  return prisma;
}

async function main() {
  const prisma = await getPrisma();
  const lecturer = await prisma.lecturer.upsert({
    where: { email: 'testlecturer@example.com' },
    update: {},
    create: {
      fullName: 'Test Lecturer',
      email: 'testlecturer@example.com',
      phoneNumber: '1234567890',
      departmentId: '437ad0c0-ed92-40c5-9e5f-0e6ac314a074',
      institutionId: 'test-inst-001',
      passwordHash: 'testpass123',
    },
  });
  console.log('Lecturer:', lecturer);
  await prisma.$disconnect();
}

main().catch(console.error);
