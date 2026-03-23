const { prisma } = require('../lib/prisma');

async function main() {
  const institutions = await prisma.institution.findMany({ take: 5 });
  institutions.forEach((inst: any) => {
    console.log(`id: ${inst.id}, name: ${inst.name}`);
  });
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
