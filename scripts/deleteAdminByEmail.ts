import { prisma } from "../lib/prisma";

async function deleteAdminByEmail(email: string) {
  const deleted = await prisma.admin.deleteMany({ where: { email } });
  console.log(`Deleted ${deleted.count} admin(s) with email: ${email}`);
  await prisma.$disconnect();
}

// Replace with the email of the admin you want to delete:
deleteAdminByEmail("REPLACE_WITH_ADMIN_EMAIL").catch(console.error);
