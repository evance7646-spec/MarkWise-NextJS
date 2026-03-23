import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyLecturerAccessToken } from '@/lib/lecturerAuthJwt';
import { verifyStudentAccessToken } from '@/lib/studentAuthJwt';

function formatMaterial(m: any) {
  return {
    id: m.id,
    unitId: m.unitId,
    title: m.title,
    description: m.description,
    type: m.type,
    fileUrl: m.fileUrl,
    linkUrl: m.linkUrl,
    text: m.textContent,
    mimeType: m.mimeType,
    fileSize: m.fileSize,
    lecturerId: m.lecturerId,
    createdAt: String(new Date(m.createdAt).getTime()),
  };
}

// GET /api/materials?unitId=xxx&lecturerId=xxx — Query materials
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  let authed = false;
  let studentId: string | null = null;
  try { verifyLecturerAccessToken(token); authed = true; } catch {}
  if (!authed) {
    try {
      const s = verifyStudentAccessToken(token);
      authed = true;
      studentId = s.studentId;
    } catch {}
  }
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get('unitId');
  const lecturerId = searchParams.get('lecturerId');

  if (!unitId && !lecturerId) {
    return NextResponse.json({ error: 'Provide at least unitId or lecturerId query param' }, { status: 400 });
  }

  // Students may only query materials for units they are enrolled in
  if (studentId && unitId) {
    const enrollment = await prisma.enrollment.findFirst({ where: { studentId, unitId } });
    if (!enrollment) return NextResponse.json({ error: 'Not enrolled in unit' }, { status: 403 });
  }

  const materials = await prisma.material.findMany({
    where: {
      ...(unitId ? { unitId } : {}),
      ...(lecturerId ? { lecturerId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(materials.map(formatMaterial));
}





