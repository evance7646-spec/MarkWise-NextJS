import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const rows = await p.unitsByYearSemester.findMany();
console.log('UnitsByYearSemester count:', rows.length);
console.log(JSON.stringify(rows, null, 2));
await p.$disconnect();
