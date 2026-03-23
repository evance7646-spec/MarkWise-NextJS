import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a sample institution
  const institution = await prisma.institution.create({
    data: {
      name: 'Sample University',
      logoUrl: '/logos/sample-university.png',
    },
  });

  // Create a sample department for that institution
  await prisma.department.create({
    data: {
      name: 'Computer Science',
      institutionId: institution.id,
    },
  });

  console.log('Seeded institution and department.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
