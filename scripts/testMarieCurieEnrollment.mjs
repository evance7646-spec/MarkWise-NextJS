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

// Get the student who has no snapshot
const auth = await prisma.studentAuth.findFirst({
  where: { email: "mariecurie@gmail.com" },
  select: { studentId: true, email: true },
});

console.log("StudentAuth record:", auth);

// Check if studentId points to a valid Student
const student = await prisma.student.findUnique({
  where: { id: auth.studentId },
  select: { id: true, admissionNumber: true, email: true },
});
console.log("Student record:", student);

await prisma.$disconnect();

if (!student) {
  console.log("\n⚠️  BROKEN: studentId in StudentAuth has no matching Student row — JWT will contain a dangling ID");
  process.exit(1);
}

// Mint a JWT for this student exactly as the app does
const token = jwt.sign(
  { userId: auth.studentId, studentId: auth.studentId, admissionNumber: student.admissionNumber, email: student.email },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

// Fire the POST
const r = await fetch("http://localhost:3000/api/student/enrollment", {
  method: "POST",
  headers,
  body: JSON.stringify({
    unitCodes: ["SCH2170", "SCH2175"],
    unitNamesMap: { SCH2170: "Organic Chemistry", SCH2175: "Physical Chemistry" },
    year: "1",
    semester: "1",
  }),
});
console.log(`\nPOST: HTTP ${r.status}`, await r.json());

const r2 = await fetch("http://localhost:3000/api/student/enrollment", { headers });
console.log(`GET:  HTTP ${r2.status}`, await r2.json());
