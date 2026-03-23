const prisma = require('../dist/lib/prisma').prisma;

async function main() {
  const departments = await prisma.department.findMany();
  console.log('Total departments:', departments.length);
  departments.forEach(d => console.log(`ID: ${d.id}, Name: ${d.name}, Institution: ${d.institutionId}`));
  await prisma.$disconnect();
}

main().catch(console.error);