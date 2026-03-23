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
const r = await prisma.offlineAttendanceRecord.deleteMany({ 
  where: { deviceId: { in: ["TEST-DEVICE-001", "TEST-EDGE-001"] } } 
});
console.log("Deleted test records:", r.count);
await prisma.$disconnect();
