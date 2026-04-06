/**
 * One-time script to create a super_admin account.
 * Usage: npx ts-node -P tsconfig.json scripts/createSuperAdmin.ts
 *
 * Customize the values below before running (or pass via env vars).
 */
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/hash";

const FULL_NAME = process.env.SA_NAME    ?? "Super Admin";
const EMAIL     = process.env.SA_EMAIL   ?? "super@markwise.com";
const PASSWORD  = process.env.SA_PASS    ?? "Admin1234!";

async function main() {
  const existing = await prisma.admin.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`Account already exists for ${EMAIL} (role: ${existing.role}). Aborting.`);
    return;
  }

  const hashed = await hashPassword(PASSWORD);
  const admin = await prisma.admin.create({
    data: {
      fullName: FULL_NAME,
      email:    EMAIL,
      password: hashed,
      role:     "super_admin",
    },
  });

  console.log(`✓ Super admin created:`);
  console.log(`  ID:    ${admin.id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Role:  ${admin.role}`);
  console.log(`\nSign in at /admin/login with:`);
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
