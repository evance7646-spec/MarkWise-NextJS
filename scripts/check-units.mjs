import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const [count, units] = await Promise.all([
  p.unit.count(),
  p.unit.findMany({
    take: 5,
    select: {
      id: true, code: true, title: true, departmentId: true,
      department: { select: { name: true, institutionId: true } }
    }
  })
]);
console.log('Total units:', count);
console.log(JSON.stringify(units, null, 2));
await p.$disconnect();
