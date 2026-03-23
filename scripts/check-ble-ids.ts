import { PrismaClient } from '@prisma/client';
import { BLEIdManager } from '../lib/ble/BLEIdManager.js';

const prisma = new PrismaClient();
const rooms = await prisma.room.findMany({ select: { roomCode: true, bleId: true, institutionId: true } });
const units = await prisma.unit.findMany({ select: { code: true, bleId: true } });

console.log('=== ROOMS ===');
for (const r of rooms) {
  const formatted = r.bleId != null ? BLEIdManager.formatId(r.bleId, 'room') : 'null';
  console.log(`  ${r.roomCode}: bleId=${r.bleId} → ${formatted}`);
}
console.log('\n=== UNITS ===');
for (const u of units) {
  const formatted = u.bleId != null ? BLEIdManager.formatId(u.bleId, 'unit') : 'null';
  console.log(`  ${u.code}: bleId=${u.bleId} → ${formatted}`);
}

await prisma.$disconnect();
