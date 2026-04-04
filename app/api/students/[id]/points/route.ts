import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveAdminScope } from '@/lib/adminScope';

export const runtime = 'nodejs';

// GET /api/students/[id]/points
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const scope = await resolveAdminScope(req);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  const { id: studentId } = await context.params;

  // Verify student exists and belongs to this admin's scope
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, institutionId: true, departmentId: true },
  });
  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }
  if (!scope.isInstitutionAdmin) {
    if (!scope.departmentId || scope.departmentId !== student.departmentId) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }
  } else {
    if (scope.institutionId && student.institutionId !== scope.institutionId) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }
  }

  const points = await prisma.studentPoints.findUnique({
    where: { studentId },
    select: {
      totalPoints: true,
      currentStreak: true,
      longestStreak: true,
      attendancePct: true,
      statsJson: true,
      breakdownJson: true,
      computedAt: true,
    },
  });

  if (!points) {
    return NextResponse.json({ points: null });
  }

  return NextResponse.json({
    points: {
      totalPoints: points.totalPoints,
      currentStreak: points.currentStreak,
      longestStreak: points.longestStreak,
      attendancePct: points.attendancePct,
      statsJson: points.statsJson ? JSON.stringify(points.statsJson) : null,
      breakdownJson: points.breakdownJson ? JSON.stringify(points.breakdownJson) : null,
      computedAt: points.computedAt,
    },
  });
}
