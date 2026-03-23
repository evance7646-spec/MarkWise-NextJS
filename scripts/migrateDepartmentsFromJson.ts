import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";

const departmentsPath = path.join(__dirname, "../data/departments.json");
const departments = JSON.parse(fs.readFileSync(departmentsPath, "utf-8"));

async function migrateDepartments() {
  for (const department of departments) {
    const exists = await prisma.department.findUnique({ where: { id: department.id } });
    if (!exists) {
      await prisma.department.create({
        data: {
          id: department.id,
          name: department.name,
          institutionId: department.institutionId,
        },
      });
      console.log(`Migrated department: ${department.name}`);
    } else {
      console.log(`Department already exists: ${department.name}`);
    }
  }
  await prisma.$disconnect();
}

migrateDepartments().catch((e) => {
  console.error(e);
  process.exit(1);
});
