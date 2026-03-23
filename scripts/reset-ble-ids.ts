// scripts/reset-ble-ids.ts
// Clears all InstitutionMappingSet records and resets all room/unit bleIds to null.
// Run this before re-running migrate:ble-ids to get clean 3-digit IDs.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetBleIds() {
  console.log('🧹 Resetting BLE IDs and clearing stale mappings...');

  const deletedMappings = await prisma.institutionMappingSet.deleteMany({});
  console.log(`  ✅ Deleted ${deletedMappings.count} InstitutionMappingSet records`);

  const resetUnits = await prisma.unit.updateMany({ data: { bleId: null } });
  console.log(`  ✅ Reset bleId for ${resetUnits.count} units`);

  const resetRooms = await prisma.room.updateMany({ data: { bleId: null } });
  console.log(`  ✅ Reset bleId for ${resetRooms.count} rooms`);

  console.log('\n✅ Done. Now run: npm run migrate:ble-ids');
  await prisma.$disconnect();
}

resetBleIds().catch((err) => {
  console.error(err);
  process.exit(1);
});
