import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocal = path.join(__dirname, "..", ".env.local");
for (const line of fs.readFileSync(envLocal, "utf-8").split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
}

const prisma = new PrismaClient();
const student = await prisma.student.findFirst({ select: { id: true, admissionNumber: true, email: true } });
await prisma.$disconnect();

const token = jwt.sign(
  { userId: student.id, studentId: student.id, admissionNumber: student.admissionNumber, email: student.email },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

const r = await fetch("http://localhost:3000/api/student/attendance/summary", {
  headers: { Authorization: `Bearer ${token}` },
});
console.log(`HTTP ${r.status}`);
console.log(JSON.stringify(await r.json(), null, 2));
