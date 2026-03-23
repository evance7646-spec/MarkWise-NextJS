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

// 1 — GET before any data
let r = await fetch("http://localhost:3000/api/student/enrollment", { headers });
console.log(`GET (empty): HTTP ${r.status}`, await r.json());

// 2 — POST to save
r = await fetch("http://localhost:3000/api/student/enrollment", {
  method: "POST",
  headers,
  body: JSON.stringify({
    unitCodes: ["SCH2170", "SCH2175", "SCH2180"],
    unitNamesMap: { SCH2170: "Organic Chemistry", SCH2175: "Physical Chemistry", SCH2180: "Inorganic Chemistry" },
    year: "2",
    semester: "1",
  }),
});
console.log(`POST: HTTP ${r.status}`, await r.json());

// 3 — GET after save
r = await fetch("http://localhost:3000/api/student/enrollment", { headers });
console.log(`GET (after save): HTTP ${r.status}`, JSON.stringify(await r.json(), null, 2));

// 4 — POST again (upsert)
r = await fetch("http://localhost:3000/api/student/enrollment", {
  method: "POST",
  headers,
  body: JSON.stringify({
    unitCodes: ["SCH2170"],
    unitNamesMap: { SCH2170: "Organic Chemistry" },
    year: "2",
    semester: "2",
  }),
});
console.log(`POST (upsert): HTTP ${r.status}`, await r.json());

r = await fetch("http://localhost:3000/api/student/enrollment", { headers });
console.log(`GET (after upsert): HTTP ${r.status}`, JSON.stringify(await r.json(), null, 2));
