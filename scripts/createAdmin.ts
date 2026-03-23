const { prisma } = require('../lib/prisma');
const bcrypt = require('bcryptjs');

async function main() {
  const adminId = '1e8f39a6-3c1b-4043-b795-47286d88baf8';
  const departmentId = '1e8f39a6-3c1b-4043-b795-47286d88baf8'; // Department of Zoology
  const institutionId = 'c5e4039c-ec56-4641-8e8f-e3caaa33f547'; // Maseno University
  const email = 'deptadmin@example.com';
  const password = 'password123'; // Change this after creation
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.admin.upsert({
    where: { id: adminId },
    update: { departmentId },
    create: {
      id: adminId,
      fullName: 'Department Admin',
      email,
      password: passwordHash,
      role: 'department',
      institutionId,
      departmentId,
    },
  });
  console.log('Admin created or updated:', { id: admin.id, email: admin.email, departmentId });
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
