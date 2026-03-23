const prisma = require('../dist/lib/prisma').prisma;

async function main() {
  // Find all departments grouped by name and institutionId
  const departments = await prisma.department.findMany();
  const grouped = {};
  departments.forEach(d => {
    const key = `${d.name.trim().toLowerCase()}_${d.institutionId}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  });

  let deleted = 0;
  for (const group of Object.values(grouped)) {
    if (group.length > 1) {
      // Keep the first, delete the rest
      for (let i = 1; i < group.length; i++) {
        await prisma.department.delete({ where: { id: group[i].id } });
        deleted++;
      }
    }
  }
  console.log(`Deleted ${deleted} duplicate departments.`);
  await prisma.$disconnect();
}

main().catch(console.error);