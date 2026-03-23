import { prisma } from '../lib/prisma';

async function main() {
  const institutionId = process.argv[2];
  if (!institutionId) {
    console.error('Usage: node scripts/listRoomsByInstitution.js <institutionId>');
    process.exit(1);
  }
  const rooms = await prisma.room.findMany({
    where: { institutionId },
    select: { id: true, name: true, buildingCode: true, roomCode: true, status: true, isActive: true },
    orderBy: [{ buildingCode: 'asc' }, { roomCode: 'asc' }],
  });
  if (rooms.length === 0) {
    console.log('No rooms found for institution:', institutionId);
  } else {
    console.table(rooms);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
