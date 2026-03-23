const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Delete all rooms
  await prisma.room.deleteMany({});
  // Delete all units
  await prisma.unit.deleteMany({});
  console.log('All rooms and units deleted.');
}

main().finally(() => prisma.$disconnect());
