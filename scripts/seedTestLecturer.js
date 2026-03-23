// Run this script with: node scripts/seedTestLecturer.js

const { prisma } = require('../lib/prisma');

async function main() {
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
}

main().catch(console.error).finally(() => prisma.$disconnect());
