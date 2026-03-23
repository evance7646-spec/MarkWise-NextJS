const { prisma } = require('../lib/prisma');

async function main() {
  const rooms = await prisma.room.findMany({ take: 5 });
  console.log('Sample Room IDs:');
  rooms.forEach((room: any) => {
    console.log(`id: ${room.id}, name: ${room.name}, code: ${room.roomCode}`);
  });
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
