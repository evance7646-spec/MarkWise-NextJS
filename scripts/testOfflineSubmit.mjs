/**
 * Quick end-to-end test for POST /api/attendance/offline/submit
 * Usage: node scripts/testOfflineSubmit.mjs
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

// Load .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocal = path.join(__dirname, "..", ".env.local");
for (const line of fs.readFileSync(envLocal, "utf-8").split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET not found in .env.local");

const prisma = new PrismaClient();

// 1 — get a student from the DB
const student = await prisma.student.findFirst({ select: { id: true, admissionNumber: true, email: true } });
if (!student) throw new Error("No student found in DB");
console.log("Using student:", student.admissionNumber);

// 2 — get the latest ConductedSession
const session = await prisma.conductedSession.findFirst({
  orderBy: { createdAt: "desc" },
  select: { unitCode: true, lectureRoom: true, sessionStart: true },
});
if (!session) throw new Error("No ConductedSession found in DB");
console.log("Using session:", session);

await prisma.$disconnect();

// 3 — mint a student JWT
const token = jwt.sign(
  {
    userId: student.id,
    studentId: student.id,
    admissionNumber: student.admissionNumber,
    email: student.email,
  },
  JWT_SECRET,
  { expiresIn: "1h" }
);

// 4 — build the request body matching the spec
const sessionStartMs = session.sessionStart.getTime();
const scannedAtMs = sessionStartMs + 30_000; // 30 seconds into the session
const lectureRoom = session.lectureRoom.replace(/\s+/g, ""); // strip spaces for QR
const rawPayload = `${session.unitCode}@${lectureRoom};${sessionStartMs};${sessionStartMs + 3600_000}`;

const body = {
  unitCode: session.unitCode,
  lectureRoom: session.lectureRoom,
  sessionStart: sessionStartMs,
  scannedAt: scannedAtMs,
  deviceId: "TEST-DEVICE-001",
  rawPayload,
};

console.log("\nPOST body:", JSON.stringify(body, null, 2));
console.log("rawPayload:", rawPayload);

// 5 — fire the request
const resp = await fetch("http://localhost:3000/api/attendance/offline/submit", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(body),
});

const text = await resp.text();
console.log(`\nHTTP ${resp.status}`);
try {
  console.log(JSON.parse(text));
} catch {
  console.log(text);
}
