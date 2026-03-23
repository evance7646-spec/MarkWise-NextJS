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

const conRows = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS sub_second
  FROM "ConductedSession"
  WHERE EXTRACT(MILLISECONDS FROM "sessionStart") % 1000 != 0
`;
const attRows = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS sub_second
  FROM "OfflineAttendanceRecord"
  WHERE EXTRACT(MILLISECONDS FROM "sessionStart") % 1000 != 0
`;

console.log("ConductedSession sub-second rows remaining:", conRows[0].sub_second);
console.log("OfflineAttendanceRecord sub-second rows remaining:", attRows[0].sub_second);

// Also show all current ConductedSession rows
const sessions = await prisma.conductedSession.findMany({
  select: { unitCode: true, lectureRoom: true, sessionStart: true },
  orderBy: { sessionStart: "desc" },
  take: 10,
});
console.log("\nLatest ConductedSession rows:");
for (const s of sessions) {
  const ms = s.sessionStart.getTime();
  const clean = ms % 1000 === 0 ? "✓" : "✗";
  console.log(`  ${clean} ${s.unitCode} / ${s.lectureRoom} / ${ms} (${s.sessionStart.toISOString()})`);
}

await prisma.$disconnect();
