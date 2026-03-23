// Run this script with: node scripts/seedDepartment.js
let prisma;
async function getPrisma() {
  if (!prisma) {
    prisma = (await import('../lib/prisma.ts')).prisma;
  }
  return prisma;
}

async function main() {
  const prisma = await getPrisma();
  const departmentId = '437ad0c0-ed92-40c5-9e5f-0e6ac314a074';
  const institutionId = 'test-inst-001'; // Change if you have a real institution
  const name = 'Test Department';

  // Ensure institution exists
  let institution = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!institution) {
    institution = await prisma.institution.create({ data: { id: institutionId, name: 'Test Institution' } });
    console.log('Created institution:', institution);
  }

  // Ensure department exists
  let department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    department = await prisma.department.create({ data: { id: departmentId, name, institutionId } });
    console.log('Created department:', department);
  } else {
    console.log('Department already exists:', department);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
