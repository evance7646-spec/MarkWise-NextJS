import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuthToken } from '@/lib/adminAuthJwt';
import { updateInstitutionMappingSet } from '@/lib/updateInstitutionMappingSet';
import { BLEIdManager } from '@/lib/ble/BLEIdManager';

// GET /api/units?departmentId=xxx
export async function GET(req: NextRequest) {
  // No authentication required for GET

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get('departmentId');
  if (!departmentId) {
    return NextResponse.json({ error: 'departmentId is required' }, { status: 400 });
  }
  try {
    // Include courseId if available (unit may be linked to a course)
    const units = await prisma.unit.findMany({
      where: { departmentId },
      orderBy: { code: 'asc' },
      include: { semesters: { include: { year: { include: { program: true } } } } },
    });
    // Try to infer courseId from program/years/semesters if not directly present
    const unitsWithCourseId = units.map((unit: any) => {
      let courseId = unit.courseId || null;
      // Try to infer from program structure if possible
      if (!courseId && unit.semesters && unit.semesters.length > 0) {
        const program = unit.semesters[0]?.year?.program;
        if (program && program.courses && program.courses.length > 0) {
          courseId = program.courses[0].id;
        }
      }
      return { ...unit, courseId };
    });
    return NextResponse.json(unitsWithCourseId);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
  }
}

// POST /api/units
export async function POST(req: NextRequest) {
  // Require authentication; derive departmentId from the admin's DB record
  const { resolveAdminScope } = await import('@/lib/adminScope');
  const scope = await resolveAdminScope(req);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  const data = await req.json();
  const { code, title, courseId } = data;

  // Server-side departmentId: dept admin always uses their own; institution admin may specify
  const departmentId: string = scope.isInstitutionAdmin
    ? (data.departmentId ?? '').trim()
    : (scope.departmentId ?? '');

  if (!code || !title || !departmentId || !courseId) {
    return NextResponse.json({ error: 'code, title, departmentId, and courseId are required' }, { status: 400 });
  }
  try {
    // Get institutionId from department for scoped BLE ID assignment
    const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { institutionId: true } });
    const institutionId = department?.institutionId ?? '';
    const nextBleId = await BLEIdManager.getNextUnitId(institutionId);
    const unit = await prisma.unit.create({
      data: { code, title, departmentId, courseId, bleId: nextBleId },
    });
    if (institutionId) {
      await updateInstitutionMappingSet(institutionId);
    }
    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 });
  }
}
