import { PrismaClient, RoomStatus } from "@prisma/client";

const prisma = new PrismaClient();

const rooms = [
  {
    institutionId: "markwise-main",
    buildingCode: "SCI",
    roomCode: "SCI-101",
    name: "Science Lab 101",
    capacity: 80,
    type: "Laboratory",
    floor: 1,
    status: RoomStatus.free,
    isActive: true,
  },
  {
    institutionId: "markwise-main",
    buildingCode: "SCI",
    roomCode: "SCI-202",
    name: "Botany Lecture Hall",
    capacity: 140,
    type: "Lecture Hall",
    floor: 2,
    status: RoomStatus.free,
    isActive: true,
  },
  {
    institutionId: "markwise-main",
    buildingCode: "ENG",
    roomCode: "ENG-015",
    name: "Engineering Seminar Room",
    capacity: 45,
    type: "Seminar",
    floor: 0,
    status: RoomStatus.unavailable,
    isActive: true,
  },
];

async function main() {
  for (const room of rooms) {
    await prisma.room.upsert({
      where: {
        institutionId_buildingCode_roomCode: {
          institutionId: room.institutionId,
          buildingCode: room.buildingCode,
          roomCode: room.roomCode,
        },
      },
      update: {
        name: room.name,
        capacity: room.capacity,
        type: room.type,
        floor: room.floor,
        status: room.status,
        isActive: room.isActive,
      },
      create: room,
    });
  }

  console.log(`Seeded ${rooms.length} rooms.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
