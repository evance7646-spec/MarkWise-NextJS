import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocal = path.join(__dirname, "..", ".env.local");
for (const line of fs.readFileSync(envLocal, "utf-8").split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
}

const prisma = new PrismaClient();
try {
  const count = await prisma.studentEnrollmentSnapshot.count();
  console.log("Table exists. Row count:", count);
  const rows = await prisma.studentEnrollmentSnapshot.findMany();
  console.log("Rows:", JSON.stringify(rows, null, 2));
} catch (e) {
  console.error("Error:", e.message);
}
await prisma.$disconnect();
