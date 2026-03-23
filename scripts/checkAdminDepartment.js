const { prisma } = require('../lib/prisma');

async function main() {
  const adminId = '1e8f39a6-3c1b-4043-b795-47286d88baf8';
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { department: true }
  });
  if (!admin) {
    console.log('Admin not found');
    process.exit(1);
  }
  console.log('Admin:', {
    id: admin.id,
    fullName: admin.fullName,
    email: admin.email,
    departmentId: admin.departmentId,
    department: admin.department
  });
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
