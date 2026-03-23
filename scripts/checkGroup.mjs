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
const groupId = "8e09bac4-053f-4b81-8e58-2c0c992ca513";

const group = await prisma.group.findUnique({
  where: { id: groupId },
  include: {
    members: { where: { leftAt: null }, include: { student: { select: { admissionNumber: true } } } },
    unit: { select: { code: true } },
  },
});

if (!group) {
  console.log("Group not found");
} else {
  console.log("Group:", {
    id: group.id,
    name: group.name,
    locked: group.locked,
    capacity: group.capacity,
    activeMembers: group.members.length,
    isFull: group.members.length >= group.capacity,
    unitCode: group.unit?.code,
  });
  console.log("Members:", group.members.map(m => m.student?.admissionNumber));
}

await prisma.$disconnect();
