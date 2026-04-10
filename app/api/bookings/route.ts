import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAdminScope } from "@/lib/adminScope";
import { verifyFacilitiesManagerJwt } from "@/lib/facilitiesManagerAuthJwt";

export const runtime = "nodejs";

async function resolveInstitutionId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const adminScope = await resolveAdminScope(req);
  if (adminScope.ok && adminScope.institutionId) return adminScope.institutionId;

  try {
    const payload = verifyFacilitiesManagerJwt(token);
    if (payload?.institutionId) return payload.institutionId;
  } catch {}

  return null;
}

/**
 * GET /api/bookings?institutionId=&from=YYYY-MM-DD&to=YYYY-MM-DD&status=reserved
 * Returns bookings for rooms in the institution within the date range.
 */
export async function GET(req: NextRequest) {
  const institutionId = await resolveInstitutionId(req);
  if (!institutionId) {
    return NextResponse.json(
      { error: "Unauthorized. Valid admin or room manager token required." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const statusParam = searchParams.get("status");

  // Fallback: last 30 days → next 7 days
  const from = fromParam ? new Date(fromParam) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
  const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; })();

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid from or to date." }, { status: 400 });
  }

  const where: Record<string, unknown> = {
    room: { institutionId },
    startAt: { gte: from },
    endAt: { lte: to },
  };
  if (statusParam) where.status = statusParam;

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { startAt: "asc" },
    include: {
      room: { select: { id: true, buildingCode: true, roomCode: true, name: true, capacity: true, type: true, floor: true } },
      lecturer: { select: { id: true, fullName: true, email: true } },
      unit: { select: { id: true, code: true, title: true } },
    },
  });

  // Normalize unit.name for UI compatibility
  const normalized = bookings.map((b) => ({
    ...b,
    unit: b.unit ? { ...b.unit, name: b.unit.title } : null,
  }));

  return NextResponse.json({ bookings: normalized, total: normalized.length });
}
