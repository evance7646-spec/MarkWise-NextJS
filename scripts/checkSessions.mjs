import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const n = await prisma.conductedSession.count();
const recent = await prisma.conductedSession.findMany({ take: 5, orderBy: { createdAt: "desc" } });
console.log("ConductedSession rows:", n);
console.log("Most recent:", JSON.stringify(recent, null, 2));
await prisma.$disconnect();
