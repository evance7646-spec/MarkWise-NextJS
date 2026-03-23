import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.institutionMappingSet.create({
    data: {
      institutionId: '1d627f9a-afbf-455e-a632-685d75f4147a',
      version: '2026-03-06T12:00:00Z',
      unitMappings: { "CS101": { id: "u1", displayName: "Intro CS", metadata: {}, rawCode: "CS101" } },
      roomMappings: { "A101": { id: "r1", displayName: "Room A101", building: "A", floor: 1, metadata: {}, rawCode: "A101" } },
      reverseUnit: { "u1": "CS101" },
      reverseRoom: { "r1": "A101" },
      normalizedUnit: { "cs101": "CS101" }
    }
  });
  console.log('Seeded mapping set!');
}

main().finally(() => prisma.$disconnect());
