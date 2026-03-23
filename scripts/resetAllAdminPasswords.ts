import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/hash";
import fs from "fs";
import path from "path";

const adminsPath = path.join(__dirname, "../data/adminUsers.json");
const admins = JSON.parse(fs.readFileSync(adminsPath, "utf-8"));

const NEW_PASSWORD = "Evance@2005...";

async function resetAllAdminPasswords() {
  const hashed = await hashPassword(NEW_PASSWORD);
  for (const admin of admins) {
    await prisma.admin.update({
      where: { email: admin.email },
      data: { password: hashed },
    });
    console.log(`Reset password for: ${admin.email}`);
  }
  await prisma.$disconnect();
  console.log("All admin passwords reset.");
}

resetAllAdminPasswords().catch((e) => {
  console.error(e);
  process.exit(1);
});
