const { prisma } = require('../lib/prisma');

async function main() {
  const departments = await prisma.department.findMany({ take: 5 });
  departments.forEach((dept: any) => {
    console.log(`id: ${dept.id}, name: ${dept.name}`);
  });
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
