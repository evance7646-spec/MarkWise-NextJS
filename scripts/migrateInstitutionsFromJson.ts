import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";

const institutionsPath = path.join(__dirname, "../data/institutions.json");
const institutions = JSON.parse(fs.readFileSync(institutionsPath, "utf-8"));

async function migrateInstitutions() {
  for (const institution of institutions) {
    const exists = await prisma.institution.findUnique({ where: { id: institution.id } });
    if (!exists) {
      await prisma.institution.create({
        data: {
          id: institution.id,
          name: institution.name,
          logoUrl: institution.logoUrl,
        },
      });
      console.log(`Migrated institution: ${institution.name}`);
    } else {
      console.log(`Institution already exists: ${institution.name}`);
    }
  }
  await prisma.$disconnect();
}

migrateInstitutions().catch((e) => {
  console.error(e);
  process.exit(1);
});
