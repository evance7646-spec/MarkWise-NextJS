/**
 * Tests the scannedAt=0 edge case - should NOT trigger WINDOW_EXPIRED
 * Usage: node scripts/testOfflineEdgeCases.mjs
 */
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

const JWT_SECRET = process.env.JWT_SECRET;
const prisma = new PrismaClient();

const student = await prisma.student.findFirst({ select: { id: true, admissionNumber: true, email: true } });
const session = await prisma.conductedSession.findFirst({ orderBy: { createdAt: "desc" }, select: { unitCode: true, lectureRoom: true, sessionStart: true } });
await prisma.$disconnect();

const token = jwt.sign({ userId: student.id, studentId: student.id, admissionNumber: student.admissionNumber, email: student.email }, JWT_SECRET, { expiresIn: "1h" });

const base = {
  unitCode: session.unitCode,
  lectureRoom: session.lectureRoom,
  sessionStart: session.sessionStart.getTime(),
  deviceId: "TEST-EDGE-001",
  rawPayload: `${session.unitCode}@${session.lectureRoom.replace(/\s+/g, "")};${session.sessionStart.getTime()};${session.sessionStart.getTime() + 3600000}`,
};

async function call(extraFields, label) {
  const r = await fetch("http://localhost:3000/api/attendance/offline/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...base, ...extraFields }),
  });
  const json = await r.json();
  console.log(`[${label}] HTTP ${r.status}:`, json.message ?? json);
}

await call({ scannedAt: 0 }, "scannedAt=0 (should be 200 or 409, NOT 422)");
await call({ /* no scannedAt */ }, "no scannedAt (should be 200 or 409)");
await call({ scannedAt: null }, "scannedAt=null (should be 200 or 409)");

// cleanup
const prisma2 = new PrismaClient();
for (const line of fs.readFileSync(envLocal, "utf-8").split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
}
const del = await prisma2.offlineAttendanceRecord.deleteMany({ where: { deviceId: "TEST-EDGE-001" } });
console.log(`\nCleaned up ${del.count} edge-case test records`);
await prisma2.$disconnect();
