import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyLecturerAccessToken } from '@/lib/lecturerAuthJwt';
import { formatGroup } from '@/lib/formatGroup';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

/** Resolve a unit code to a Unit row, or null. */
async function resolveUnitByCode(raw: string) {
  let code = raw.trim();
  const parenMatch = code.match(/\(([^)]+)\)\s*$/);
  if (parenMatch) code = parenMatch[1].trim();
  let unit = await prisma.unit.findFirst({ where: { code: { equals: code, mode: 'insensitive' } } });
  if (unit) return unit;
  const normalised = code.replace(/\s+/g, '').toUpperCase();
  unit = await prisma.unit.findFirst({ where: { code: { equals: normalised, mode: 'insensitive' } } });
  if (unit) return unit;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Unit" WHERE REPLACE(UPPER(code), ' ', '') = ${normalised} LIMIT 1
  `;
  if (rows.length > 0) return prisma.unit.findUnique({ where: { id: rows[0].id } });
  return null;
}

/**
 * POST /api/groups/create
 * Body: { unitCode, groupSize?, numGroups?, autoAssignLeaders?, allowSelfEnroll?,
 *         maxGroupsPerStudent?, description?, tags? }
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  let lecturer: ReturnType<typeof verifyLecturerAccessToken>;
  try { lecturer = verifyLecturerAccessToken(token); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders }); }

  const {
    unitCode,
    groupSize,
    numGroups,
    autoAssignLeaders = false,
    allowSelfEnroll = false,
    maxGroupsPerStudent = 1,
    description = null,
    tags = [],
  } = await req.json();

  if (!unitCode) return NextResponse.json({ error: 'unitCode is required' }, { status: 400, headers: corsHeaders });
  if (!groupSize && !numGroups) return NextResponse.json({ error: 'groupSize or numGroups is required' }, { status: 400, headers: corsHeaders });

  const unit = await resolveUnitByCode(unitCode);
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404, headers: corsHeaders });

  // Determine enrolled students not already in any active group for this unit
  const enrollments = await prisma.enrollment.findMany({
    where: { unitId: unit.id },
    select: { studentId: true },
  });
  const alreadyInGroup = await prisma.groupMember.findMany({
    where: { leftAt: null, group: { unitId: unit.id } },
    select: { studentId: true },
  });
  const assignedSet = new Set(alreadyInGroup.map(m => m.studentId));
  const unassigned = enrollments.map(e => e.studentId).filter(id => !assignedSet.has(id));

  // Compute count and names
  const count: number = numGroups ?? Math.max(1, Math.ceil(unassigned.length / Math.max(1, groupSize)));

  // Find the current max groupNumber for this unit to ensure stable sequential numbering
  const maxResult = await prisma.group.aggregate({
    where: { unitId: unit.id },
    _max: { groupNumber: true },
  });
  const startNumber = (maxResult._max.groupNumber ?? 0) + 1;

  // Distribute students round-robin across groups
  const groupMemberSets: string[][] = Array.from({ length: count }, () => []);
  unassigned.forEach((studentId, i) => {
    groupMemberSets[i % count].push(studentId);
  });

  // Shuffle members within each group when autoAssignLeaders so leader selection is random
  const shuffle = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const created = await prisma.$transaction(
    Array.from({ length: count }, (_, i) => {
      const members = autoAssignLeaders ? shuffle([...groupMemberSets[i]]) : groupMemberSets[i];
      const leaderId = autoAssignLeaders && members.length > 0 ? members[0] : null;
      const groupNum = startNumber + i;
      return prisma.group.create({
        data: {
          name: `Group ${groupNum}`,
          unitId: unit.id,
          unitCode: unit.code,
          groupNumber: groupNum,
          leaderId,
          allowSelfEnroll,
          maxGroupsPerStudent,
          description,
          tags,
          ...(members.length > 0 && {
            members: {
              create: members.map(studentId => ({
                studentId,
                role: studentId === leaderId ? 'leader' : 'member',
              })),
            },
          }),
        },
        include: {
          unit: { select: { code: true } },
          members: { where: { leftAt: null }, include: { student: { select: { name: true, admissionNumber: true } } } },
        },
      });
    })
  );

  return NextResponse.json({ groups: created.map(g => formatGroup(g)) }, { status: 201, headers: corsHeaders });
}

