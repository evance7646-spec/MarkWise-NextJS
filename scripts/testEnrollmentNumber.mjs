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
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

// Test with year/semester as NUMBERS (what the real app may send)
let r = await fetch("http://localhost:3000/api/student/enrollment", {
  method: "POST",
  headers,
  body: JSON.stringify({
    unitCodes: ["SCH2170", "SCH2175", "SCH2180"],
    unitNamesMap: { SCH2170: "Organic Chemistry", SCH2175: "Physical Chemistry", SCH2180: "Inorganic Chemistry" },
    year: 2,       // NUMBER — old code rejected this with 422
    semester: 1,   // NUMBER — old code rejected this with 422
  }),
});
console.log(`POST (year:number): HTTP ${r.status}`, await r.json());

r = await fetch("http://localhost:3000/api/student/enrollment", { headers });
const data = await r.json();
console.log(`GET: HTTP ${r.status} year="${data.year}" (${typeof data.year}) semester="${data.semester}"`);
console.log("unitCodes:", data.unitCodes);
