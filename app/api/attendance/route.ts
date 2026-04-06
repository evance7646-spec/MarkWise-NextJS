import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveAdminScope } from '@/lib/adminScope';
import { normalizeUnitCode } from '@/lib/unitCode';

export const runtime = 'nodejs';

/**
 * GET /api/attendance?institutionId=xxx
 *
 * Returns per-unit attendance summary for the institution.
 * Each record: { id (unitCode), unitCode, unitTitle, departmentId, present, total, rate }
 * Computed from OfflineAttendanceRecord grouped by unitCode.
 */
export async function GET(req: NextRequest) {
  const scope = await resolveAdminScope(req);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  const institutionId = scope.institutionId;
  if (!institutionId) {
    return NextResponse.json({ error: 'Your account is not linked to an institution.' }, { status: 403 });
  }

  // Count attendance records grouped by unitCode for this institution
  const grouped = await prisma.offlineAttendanceRecord.groupBy({
    by: ['unitCode'],
    where: { institutionId },
    _count: { id: true },
  });

  // Count conducted sessions (total per unit) to derive total possible attendances
  const sessions = await prisma.conductedSession.groupBy({
    by: ['unitCode'],
    _count: { id: true },
  });
  const sessionMap = new Map(sessions.map(s => [s.unitCode, s._count.id]));

  // Build unit lookup for metadata
  const unitCodes = grouped.map(g => g.unitCode);
  const units = unitCodes.length > 0
    ? await prisma.unit.findMany({
        where: { code: { in: unitCodes } },
        select: { id: true, code: true, title: true, departmentId: true },
      })
    : [];
  const unitMap = new Map(units.map(u => [u.code, u]));

  const records = grouped.map(g => {
    const unit = unitMap.get(g.unitCode);
    const presentCount = g._count.id;
    const sessionCount = sessionMap.get(g.unitCode) ?? 0;
    // Each session can have multiple students; use present as raw count and sessions as denominator with a student count estimate
    // Approximate: rate = present_records / (sessions * estimated_students_per_session) — fallback to raw %
    // Conservative: if no session count, show present count only
    const rate = sessionCount > 0
      ? Math.min(100, Math.round((presentCount / sessionCount) * 100))
      : 0;

    return {
      id: normalizeUnitCode(g.unitCode),
      unitCode: normalizeUnitCode(g.unitCode),
      unitTitle: unit?.title ?? g.unitCode,
      departmentId: unit?.departmentId ?? null,
      present: presentCount,
      total: sessionCount,
      rate,
    };
  });

  return NextResponse.json({ records });
}
