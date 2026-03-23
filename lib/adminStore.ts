import { prisma } from "@/lib/prisma";
import path from "node:path";

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: "department_admin" | "institution_admin";
  createdAt: string;
};

const dataDir = path.join(process.cwd(), "data");
const dataFilePath = path.join(dataDir, "adminUsers.json");

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isAdminUser = (value: unknown): value is AdminUser => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.fullName === "string" &&
    typeof item.email === "string" &&
    typeof item.passwordHash === "string" &&
    (item.role === "department_admin" || item.role === "institution_admin") &&
    typeof item.createdAt === "string"
  );
};

// Fetch all admin users from the database
export async function readAdminUsers(): Promise<AdminUser[]> {
  const admins = await prisma.admin.findMany();
  return admins.map((item) => ({
    id: item.id,
    fullName: item.fullName,
    email: item.email,
    passwordHash: item.password, // Prisma model uses 'password'
    role: item.role as 'department_admin' | 'institution_admin',
    createdAt: item.createdAt.toISOString(),
  }));
}

// Deprecated: Use Prisma create/update/delete methods directly for persistence
export async function writeAdminUsers(users: AdminUser[]) {
  throw new Error("writeAdminUsers is deprecated. Use Prisma directly.");
}
