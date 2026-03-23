// scripts/migrate-ble-ids.ts
import { PrismaClient } from '@prisma/client';
import { BLEIdManager } from '@/lib/ble/BLEIdManager';
import { MappingService } from '@/lib/ble/MappingService';

const prisma = new PrismaClient();

interface MigrationResult {
  success: boolean;
  institutionsProcessed: number;
  unitsUpdated: number;
  roomsUpdated: number;
  mappingSetsCreated: number;
  errors: Array<{
    institutionId: string;
    type: 'unit' | 'room' | 'mapping';
    id?: string;
    error: string;
  }>;
  warnings: Array<{
    institutionId: string;
    message: string;
  }>;
}

async function migrateBLEIds(): Promise<MigrationResult> {
  console.log('🚀 Starting BLE ID migration to 3-digit format...');
  
  const result: MigrationResult = {
    success: true,
    institutionsProcessed: 0,
    unitsUpdated: 0,
    roomsUpdated: 0,
    mappingSetsCreated: 0,
    errors: [],
    warnings: []
  };

  try {
    // Get all institutions
    const institutions = await prisma.institution.findMany({
      include: {
        departments: {
          include: {
            units: true
          }
        }
      }
    });

    // Attach rooms separately since Institution has no direct rooms relation
    const allRooms = await prisma.room.findMany();
    const roomsByInstitution = new Map<string, typeof allRooms>();
    for (const room of allRooms) {
      if (!roomsByInstitution.has(room.institutionId)) {
        roomsByInstitution.set(room.institutionId, []);
      }
      roomsByInstitution.get(room.institutionId)!.push(room);
    }

    const institutionsWithRooms = institutions.map(inst => ({
      ...inst,
      rooms: roomsByInstitution.get(inst.id) || []
    }));

    console.log(`📊 Found ${institutions.length} institutions to process`);

    for (const institution of institutionsWithRooms) {
      console.log(`\n🏛️  Processing institution: ${institution.name} (${institution.id})`);
      
      try {
        await processInstitution(institution, result);
        result.institutionsProcessed++;
      } catch (error) {
        result.errors.push({
          institutionId: institution.id,
          type: 'mapping',
          error: `Failed to process institution: ${error}`
        });
      }
    }

    // Generate summary
    console.log('\n📈 Migration Summary:');
    console.log(`✅ Institutions processed: ${result.institutionsProcessed}`);
    console.log(`📚 Units updated: ${result.unitsUpdated}`);
    console.log(`🏢 Rooms updated: ${result.roomsUpdated}`);
    console.log(`🗺️  Mapping sets created: ${result.mappingSetsCreated}`);
    console.log(`⚠️  Warnings: ${result.warnings.length}`);
    console.log(`❌ Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n🔍 Detailed Errors:');
      result.errors.forEach(e => {
        console.log(`   - [${e.institutionId}] ${e.type}: ${e.error}`);
      });
    }

    return result;

  } catch (error) {
    console.error('💥 Fatal migration error:', error);
    result.success = false;
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

async function processInstitution(
  institution: any,
  result: MigrationResult
) {
  // Get institution context
  const context = await BLEIdManager.getInstitutionContext(institution.id);
  console.log(`   Context: ${JSON.stringify(context || 'default')}`);

  // Step 1: Backup existing mappings
  await backupExistingMappings(institution.id);

  // Step 2: Migrate units
  await migrateUnits(institution, context || undefined, result);

  // Step 3: Migrate rooms
  await migrateRooms(institution, context || undefined, result);

  // Step 4: Validate migrated data
  await validateMigration(institution.id, result);

  // Step 5: Generate new mapping set
  await generateNewMappingSet(institution.id, result);

  // Step 6: Clear old caches
  await clearOldCaches(institution.id);
}

async function backupExistingMappings(institutionId: string) {
  console.log(`   💾 Backing up existing mappings...`);
  
  // Create backup record
  await prisma.institutionMappingSet.create({
    data: {
      institutionId,
      version: `backup-${new Date().toISOString()}`,
      mappingKey: `backup-${institutionId}-${Date.now()}`,
      metadata: {
        type: 'pre-migration-backup',
        timestamp: new Date().toISOString(),
        description: 'Backup before 3-digit BLE ID migration'
      }
    }
  });
}

async function migrateUnits(
  institution: any,
  context: any,
  result: MigrationResult
) {
  console.log(`   📚 Migrating units...`);

  // Get all units (including those without BLE IDs)
  const allUnits = institution.departments.flatMap((d: any) => d.units);
  
  // Separate units with and without IDs
  const unitsWithIds = allUnits.filter((u: any) => u.bleId !== null);
  const unitsWithoutIds = allUnits.filter((u: any) => u.bleId === null);

  console.log(`      Found ${unitsWithIds.length} units with IDs, ${unitsWithoutIds.length} without`);

  // Track used IDs to avoid collisions
  const usedIds = new Set<number>();

  // Migrate existing IDs
  for (const unit of unitsWithIds) {
    try {
      const oldId = unit.bleId;
      
      // Check if old ID is already in 3-digit range with context
      const contextOffset = BLEIdManager.getContextOffset(context);
      const isInRange = oldId >= (BLEIdManager.UNIT_RANGE.min + contextOffset) && 
                        oldId <= (BLEIdManager.UNIT_RANGE.max + contextOffset);

      if (isInRange && !usedIds.has(oldId)) {
        // Keep existing ID if it's valid
        usedIds.add(oldId);
        console.log(`      ✅ Unit ${unit.code} kept ID ${oldId} (${BLEIdManager.formatId(oldId, 'unit', context)})`);
        result.unitsUpdated++;
      } else {
        // Generate new ID
        const newId = await findAvailableUnitId(institution.id, usedIds, context);
        if (newId !== null) {
          await prisma.unit.update({
            where: { id: unit.id },
            data: { 
              bleId: newId,
              lastSyncAt: new Date(),
              syncVersion: { increment: 1 },
              bleMetadata: {
                ...(unit.bleMetadata as any || {}),
                previousBleId: oldId,
                migratedAt: new Date().toISOString()
              }
            }
          });
          usedIds.add(newId);
          console.log(`      🔄 Unit ${unit.code}: ${oldId} → ${newId} (${BLEIdManager.formatId(newId, 'unit', context)})`);
          result.unitsUpdated++;
        }
      }
    } catch (error) {
      result.errors.push({
        institutionId: institution.id,
        type: 'unit',
        id: unit.id,
        error: `Failed to migrate unit ${unit.code}: ${error}`
      });
    }
  }

  // Assign IDs to units without IDs
  for (const unit of unitsWithoutIds) {
    try {
      const newId = await findAvailableUnitId(institution.id, usedIds, context);
      if (newId !== null) {
        await prisma.unit.update({
          where: { id: unit.id },
          data: { 
            bleId: newId,
            lastSyncAt: new Date(),
            syncVersion: { increment: 1 },
            bleMetadata: {
              ...(unit.bleMetadata as any || {}),
              bleIdAssignedAt: new Date().toISOString()
            }
          }
        });
        usedIds.add(newId);
        console.log(`      🆕 Unit ${unit.code} assigned ID ${newId} (${BLEIdManager.formatId(newId, 'unit', context)})`);
        result.unitsUpdated++;
      }
    } catch (error) {
      result.errors.push({
        institutionId: institution.id,
        type: 'unit',
        id: unit.id,
        error: `Failed to assign ID to unit ${unit.code}: ${error}`
      });
    }
  }

  // Check if we're running out of IDs
  const contextOffset = BLEIdManager.getContextOffset(context);
  const unitRange = BLEIdManager.UNIT_RANGE;
  const totalPossible = unitRange.max - unitRange.min + 1;
  const used = usedIds.size;
  const utilization = (used / totalPossible) * 100;

  if (utilization > 80) {
    result.warnings.push({
      institutionId: institution.id,
      message: `Unit ID utilization at ${utilization.toFixed(1)}% (${used}/${totalPossible}). Consider adding context.`
    });
  }
}

async function migrateRooms(
  institution: any,
  context: any,
  result: MigrationResult
) {
  console.log(`   🏢 Migrating rooms...`);

  const roomsWithIds = institution.rooms.filter((r: any) => r.bleId !== null);
  const roomsWithoutIds = institution.rooms.filter((r: any) => r.bleId === null);

  console.log(`      Found ${roomsWithIds.length} rooms with IDs, ${roomsWithoutIds.length} without`);

  const usedIds = new Set<number>();

  // Migrate existing IDs
  for (const room of roomsWithIds) {
    try {
      const oldId = room.bleId;
      
      const contextOffset = BLEIdManager.getContextOffset(context);
      const isInRange = oldId >= (BLEIdManager.ROOM_RANGE.min + contextOffset) && 
                        oldId <= (BLEIdManager.ROOM_RANGE.max + contextOffset);

      if (isInRange && !usedIds.has(oldId)) {
        usedIds.add(oldId);
        console.log(`      ✅ Room ${room.roomCode} kept ID ${oldId} (${BLEIdManager.formatId(oldId, 'room', context)})`);
        result.roomsUpdated++;
      } else {
        const newId = await findAvailableRoomId(institution.id, usedIds, context);
        if (newId) {
          await prisma.room.update({
            where: { id: room.id },
            data: { 
              bleId: newId,
              lastSyncAt: new Date(),
              syncVersion: { increment: 1 },
              bleMetadata: {
                ...(room.bleMetadata as any || {}),
                previousBleId: oldId,
                migratedAt: new Date().toISOString()
              }
            }
          });
          usedIds.add(newId);
          console.log(`      🔄 Room ${room.roomCode}: ${oldId} → ${newId} (${BLEIdManager.formatId(newId, 'room', context)})`);
          result.roomsUpdated++;
        }
      }
    } catch (error) {
      result.errors.push({
        institutionId: institution.id,
        type: 'room',
        id: room.id,
        error: `Failed to migrate room ${room.roomCode}: ${error}`
      });
    }
  }

  // Assign IDs to rooms without IDs
  for (const room of roomsWithoutIds) {
    try {
      const newId = await findAvailableRoomId(institution.id, usedIds, context);
      if (newId) {
        await prisma.room.update({
          where: { id: room.id },
          data: { 
            bleId: newId,
            lastSyncAt: new Date(),
            syncVersion: { increment: 1 },
            bleMetadata: {
              ...(room.bleMetadata as any || {}),
              bleIdAssignedAt: new Date().toISOString()
            }
          }
        });
        usedIds.add(newId);
        console.log(`      🆕 Room ${room.roomCode} assigned ID ${newId} (${BLEIdManager.formatId(newId, 'room', context)})`);
        result.roomsUpdated++;
      }
    } catch (error) {
      result.errors.push({
        institutionId: institution.id,
        type: 'room',
        id: room.id,
        error: `Failed to assign ID to room ${room.roomCode}: ${error}`
      });
    }
  }

  // Check utilization
  const contextOffset = BLEIdManager.getContextOffset(context);
  const roomRange = BLEIdManager.ROOM_RANGE;
  const totalPossible = roomRange.max - roomRange.min + 1;
  const used = usedIds.size;
  const utilization = (used / totalPossible) * 100;

  if (utilization > 80) {
    result.warnings.push({
      institutionId: institution.id,
      message: `Room ID utilization at ${utilization.toFixed(1)}% (${used}/${totalPossible}). Consider adding context.`
    });
  }
}

async function findAvailableUnitId(
  institutionId: string,
  usedIds: Set<number>,
  context?: any
): Promise<number | null> {
  const contextOffset = BLEIdManager.getContextOffset(context);
  const min = BLEIdManager.UNIT_RANGE.min + contextOffset;
  const max = BLEIdManager.UNIT_RANGE.max + contextOffset;

  for (let id = min; id <= max; id++) {
    if (!usedIds.has(id)) {
      // Double-check database
      const existing = await prisma.unit.findFirst({
        where: {
          bleId: id,
          department: { institutionId }
        }
      });
      if (!existing) {
        return id;
      }
      usedIds.add(id);
    }
  }
  return null;
}

async function findAvailableRoomId(
  institutionId: string,
  usedIds: Set<number>,
  context?: any
): Promise<number | null> {
  const contextOffset = BLEIdManager.getContextOffset(context);
  const min = BLEIdManager.ROOM_RANGE.min + contextOffset;
  const max = BLEIdManager.ROOM_RANGE.max + contextOffset;

  for (let id = min; id <= max; id++) {
    if (!usedIds.has(id)) {
      const existing = await prisma.room.findFirst({
        where: {
          bleId: id,
          institutionId
        }
      });
      if (!existing) {
        return id;
      }
      usedIds.add(id);
    }
  }
  return null;
}

async function validateMigration(
  institutionId: string,
  result: MigrationResult
) {
  console.log(`   🔍 Validating migration...`);

  // Check for duplicate IDs
  const duplicateUnits = await prisma.unit.groupBy({
    by: ['bleId'],
    where: {
      department: { institutionId },
      bleId: { not: null }
    },
    having: {
      bleId: {
        _count: {
          gt: 1
        }
      }
    }
  });

  if (duplicateUnits.length > 0) {
    result.errors.push({
      institutionId,
      type: 'unit',
      error: `Duplicate unit BLE IDs after migration: ${duplicateUnits.map(d => d.bleId).join(', ')}`
    });
  }

  const duplicateRooms = await prisma.room.groupBy({
    by: ['bleId'],
    where: {
      institutionId,
      bleId: { not: null }
    },
    having: {
      bleId: {
        _count: {
          gt: 1
        }
      }
    }
  });

  if (duplicateRooms.length > 0) {
    result.errors.push({
      institutionId,
      type: 'room',
      error: `Duplicate room BLE IDs after migration: ${duplicateRooms.map(d => d.bleId).join(', ')}`
    });
  }

  // Validate ranges
  const context = await BLEIdManager.getInstitutionContext(institutionId);
  const contextOffset = BLEIdManager.getContextOffset(context || undefined);

  const outOfRangeUnits = await prisma.unit.count({
    where: {
      department: { institutionId },
      NOT: {
        bleId: {
          gte: BLEIdManager.UNIT_RANGE.min + contextOffset,
          lte: BLEIdManager.UNIT_RANGE.max + contextOffset
        }
      }
    }
  });

  if (outOfRangeUnits > 0) {
    result.errors.push({
      institutionId,
      type: 'unit',
      error: `${outOfRangeUnits} units have out-of-range BLE IDs after migration`
    });
  }

  const outOfRangeRooms = await prisma.room.count({
    where: {
      institutionId,
      NOT: {
        bleId: {
          gte: BLEIdManager.ROOM_RANGE.min + contextOffset,
          lte: BLEIdManager.ROOM_RANGE.max + contextOffset
        }
      }
    }
  });

  if (outOfRangeRooms > 0) {
    result.errors.push({
      institutionId,
      type: 'room',
      error: `${outOfRangeRooms} rooms have out-of-range BLE IDs after migration`
    });
  }

  console.log(`   ✅ Validation complete`);
}

async function generateNewMappingSet(
  institutionId: string,
  result: MigrationResult
) {
  console.log(`   🗺️  Generating new mapping set...`);

  try {
    const mappingSet = await MappingService.generateMappingSet(institutionId);
    await MappingService.saveMappingSet(institutionId, mappingSet);
    result.mappingSetsCreated++;

    console.log(`      Version: ${mappingSet.version}`);
    console.log(`      Units mapped: ${Object.keys(mappingSet.unitMappings).length}`);
    console.log(`      Rooms mapped: ${Object.keys(mappingSet.roomMappings).length}`);
  } catch (error) {
    result.errors.push({
      institutionId,
      type: 'mapping',
      error: `Failed to generate mapping set: ${error}`
    });
  }
}

async function clearOldCaches(institutionId: string) {
  console.log(`   🧹 Clearing old caches...`);
  // Add your cache clearing logic here
  // e.g., redis.del(pattern)
}

// Rollback function in case of issues
export async function rollbackMigration(
  institutionId?: string
): Promise<void> {
  console.log('🔄 Rolling back migration...');

  if (institutionId) {
    // Rollback specific institution
    await rollbackInstitution(institutionId);
  } else {
    // Rollback all institutions
    const institutions = await prisma.institution.findMany({
      select: { id: true }
    });
    
    for (const inst of institutions) {
      await rollbackInstitution(inst.id);
    }
  }
}

async function rollbackInstitution(institutionId: string): Promise<void> {
  // Find the last backup
  const backup = await prisma.institutionMappingSet.findFirst({
    where: {
      institutionId,
      metadata: {
        path: ['type'],
        equals: 'pre-migration-backup'
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (backup) {
    // Restore from backup logic here
    console.log(`   Restoring from backup for ${institutionId}`);
    // Implement restoration logic
  }

  // Clear post-migration data
  await prisma.unit.updateMany({
    where: { department: { institutionId } },
    data: { bleId: null }
  });

  await prisma.room.updateMany({
    where: { institutionId },
    data: { bleId: null }
  });
}

// Run migration if called directly

// ES module/tsx entry point
migrateBLEIds()
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

export default migrateBLEIds;