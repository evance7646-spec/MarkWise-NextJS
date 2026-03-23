const { prisma } = require('../lib/prisma');

async function main() {
  const adminId = '1e8f39a6-3c1b-4043-b795-47286d88baf8';
  const departmentId = '1e8f39a6-3c1b-4043-b795-47286d88baf8'; // Department of Zoology

  // Check if department exists
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    console.error('Department not found:', departmentId);
    process.exit(1);
  }

  // Update admin to link to department
  const admin = await prisma.admin.update({
    where: { id: adminId },
    data: { departmentId },
  });
  console.log('Admin linked to department:', { adminId, departmentId });
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
