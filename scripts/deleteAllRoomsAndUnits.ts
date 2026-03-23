import { prisma } from '../lib/prisma';

async function main() {
  // Delete all rooms
  await prisma.room.deleteMany({});
  // Delete all units
  await prisma.unit.deleteMany({});
  console.log('All rooms and units deleted.');
}

main().finally(() => prisma.$disconnect());
