import { prisma } from '../lib/prisma';

// Map unit codes to course IDs (example mapping, update as needed)
const unitCourseMap: Record<string, string> = {
  // 'SBT 2145': '4cd63257-ed09-46d8-a2c6-8381b32b4984', // Microbiology
  // 'SCH 2170': '95c24148-ad94-4788-995d-c53aed9af4e3', // Biochemistry
};

async function main() {
  for (const [code, courseId] of Object.entries(unitCourseMap)) {
    const unit = await prisma.unit.findFirst({ where: { code } });
    if (unit) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: { courseId },
      });
      console.log(`Updated unit ${code} with courseId ${courseId}`);
    } else {
      console.warn(`Unit with code ${code} not found.`);
    }
  }
  console.log('Done updating units.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
