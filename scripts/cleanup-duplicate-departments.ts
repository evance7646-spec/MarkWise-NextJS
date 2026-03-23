// scripts/cleanup-duplicate-departments.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicateDepartments() {
  console.log('Starting duplicate department cleanup...');
  
  // Get all departments
  const departments = await prisma.department.findMany({
    include: {
      admins: true,
      courses: true,
      lecturers: true,
      students: true,
      timetables: true,
      units: true,
      programs: true,
    },
    orderBy: { id: 'asc' },
  });

  console.log(`Found ${departments.length} total departments`);

  // Group by institutionId and name (case-insensitive)
  const groups = new Map();
  
  for (const dept of departments) {
    const key = `${dept.institutionId}:${dept.name.toLowerCase().trim()}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(dept);
  }

  let duplicateCount = 0;
  let deletedCount = 0;

  // Process each group
  for (const [key, deptList] of groups.entries()) {
    if (deptList.length > 1) {
      duplicateCount++;
      console.log(`\nFound ${deptList.length} duplicates for ${key}`);
      
      // Keep the first one (oldest by createdAt)
      const [keep, ...duplicates] = deptList;
      
      console.log(`Keeping: ${keep.name} (${keep.id}) created at ${keep.createdAt}`);
      
      for (const dup of duplicates) {
        console.log(`Processing duplicate: ${dup.name} (${dup.id})`);
        
        // Update related records to point to the kept department
        try {
          // Update admins
          if (dup.admins.length > 0) {
            await prisma.admin.updateMany({
              where: { departmentId: dup.id },
              data: { departmentId: keep.id },
            });
            console.log(`  - Updated ${dup.admins.length} admins`);
          }

          // Update courses
          if (dup.courses.length > 0) {
            await prisma.course.updateMany({
              where: { departmentId: dup.id },
              data: { departmentId: keep.id },
            });
            console.log(`  - Updated ${dup.courses.length} courses`);
          }

          // Update lecturers
          if (dup.lecturers.length > 0) {
            await prisma.lecturer.updateMany({
              where: { departmentId: dup.id },
              data: { departmentId: keep.id },
            });
            console.log(`  - Updated ${dup.lecturers.length} lecturers`);
          }

          // Update students
          if (dup.students.length > 0) {
            await prisma.student.updateMany({
              where: { departmentId: dup.id },
              data: { departmentId: keep.id },
            });
            console.log(`  - Updated ${dup.students.length} students`);
          }

          // Update timetables
          if (dup.timetables.length > 0) {
            await prisma.timetable.updateMany({
              where: { departmentId: dup.id },
              data: { departmentId: keep.id },
            });
            console.log(`  - Updated ${dup.timetables.length} timetables`);
          }

          // Update units
          if (dup.units.length > 0) {
            await prisma.unit.updateMany({
              where: { departmentId: dup.id },
              data: { departmentId: keep.id },
            });
            console.log(`  - Updated ${dup.units.length} units`);
          }

          // Update programs
          if (dup.programs.length > 0) {
            await prisma.program.updateMany({
              where: { departmentId: dup.id },
              data: { departmentId: keep.id },
            });
            console.log(`  - Updated ${dup.programs.length} programs`);
          }

          // Finally, delete the duplicate department
          await prisma.department.delete({
            where: { id: dup.id },
          });
          
          console.log(`  - Deleted duplicate department: ${dup.name} (${dup.id})`);
          deletedCount++;
          
        } catch (error) {
          console.error(`Error processing duplicate ${dup.id}:`, error);
        }
      }
    }
  }

  console.log(`\n=== Cleanup Summary ===`);
  console.log(`Total departments processed: ${departments.length}`);
  console.log(`Duplicate groups found: ${duplicateCount}`);
  console.log(`Duplicate departments deleted: ${deletedCount}`);
  console.log(`Remaining departments: ${departments.length - deletedCount}`);
}

cleanupDuplicateDepartments()
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());