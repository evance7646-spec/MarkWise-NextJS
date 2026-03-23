// Run this script with: node scripts/seedTestAdmin.js

const { prisma } = require('../dist/lib/prisma');

async function main() {
  const admin = await prisma.admin.upsert({
    where: { email: 'testadmin@example.com' },
    update: {},
    create: {
      fullName: 'Test Admin',
      email: 'testadmin@example.com',
      password: 'testadminpass',
      role: 'superadmin',
      institutionId: '0ccddc79-cb1f-4d4b-97c0-e458f39d73fe',
      departmentId: 'ff392b4b-1da0-4699-aab0-f6e633cf845b',
    },
  });
  console.log('Admin:', admin);
}

main().catch(console.error).finally(() => prisma.$disconnect());
