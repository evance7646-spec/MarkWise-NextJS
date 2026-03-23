
import { prisma } from "../lib/prisma";

import fs from "fs";
import path from "path";
// Read admins from JSON file (CommonJS style)
const adminsPath = path.join(__dirname, "../data/adminUsers.json");
const admins = JSON.parse(fs.readFileSync(adminsPath, "utf-8"));


async function migrateAdmins() {
  for (const admin of admins) {
    const exists = await prisma.admin.findUnique({ where: { email: admin.email } });
    if (!exists) {
      await prisma.admin.create({
        data: {
          id: admin.id,
          fullName: admin.fullName,
          email: admin.email,
          password: admin.passwordHash, // Already hashed
          role: admin.role,
          createdAt: new Date(admin.createdAt),
        },
      });
      console.log(`Migrated admin: ${admin.email}`);
    } else {
      console.log(`Admin already exists: ${admin.email}`);
    }
  }
  await prisma.$disconnect();
}

migrateAdmins().catch((e) => {
  console.error(e);
  process.exit(1);
});
