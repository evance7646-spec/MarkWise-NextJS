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

// All students with auth records
const authRecords = await prisma.studentAuth.findMany({
  select: { studentId: true, email: true },
});

// All enrollment snapshots
const snapshots = await prisma.studentEnrollmentSnapshot.findMany({
  select: { studentId: true, unitCodes: true, year: true, semester: true, updatedAt: true },
});

const snapshotMap = new Map(snapshots.map(s => [s.studentId, s]));

console.log(`\nStudentAuth records: ${authRecords.length}`);
console.log(`StudentEnrollmentSnapshot records: ${snapshots.length}`);
console.log("\n--- Students with auth vs enrollment snapshot ---");
for (const auth of authRecords) {
  const snap = snapshotMap.get(auth.studentId);
  if (snap) {
    console.log(`✓ ${auth.email} → year:${snap.year} sem:${snap.semester} unitCodes:[${snap.unitCodes.join(",")}] (updated ${snap.updatedAt.toISOString()})`);
  } else {
    console.log(`✗ ${auth.email} (${auth.studentId}) — NO SNAPSHOT`);
  }
}

await prisma.$disconnect();
