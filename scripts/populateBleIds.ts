import { prisma } from "@/lib/prisma";

async function main() {
  // Example: assign BLE IDs starting from 100 for units and 1000 for rooms
  let nextUnitBleId = 100;
  let nextRoomBleId = 1000;

  const units = await prisma.unit.findMany({});
  for (const unit of units) {
    if (unit.bleId == null) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: { bleId: nextUnitBleId++ },
      });
    }
  }

  const rooms = await prisma.room.findMany({});
  for (const room of rooms) {
    if (room.bleId == null) {
      await prisma.room.update({
        where: { id: room.id },
        data: { bleId: nextRoomBleId++ },
      });
    }
  }

  console.log("BLE IDs populated for all units and rooms.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
