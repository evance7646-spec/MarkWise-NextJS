import { NextResponse, type NextRequest } from 'next/server';
import { verifyLecturerAccessToken } from '@/lib/lecturerAuthJwt';
import { prisma } from '@/lib/prisma';

// GET /api/assignments/:assignmentId/submissions — List all submissions (lecturer only)
export async function GET(req: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await context.params;
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  let lecturer: ReturnType<typeof verifyLecturerAccessToken>;
  try { lecturer = verifyLecturerAccessToken(token); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.lecturerId !== lecturer.lecturerId) {
    return NextResponse.json({ error: 'Not authorized for this assignment' }, { status: 403 });
  }

  const rows = await prisma.submission.findMany({
    where: { assignmentId },
    orderBy: { submittedAt: 'asc' },
    include: { student: { select: { name: true } } },
  });

  const result = rows.map(s => ({
    id: s.id,
    assignmentId: s.assignmentId,
    studentId: s.studentId,
    studentName: s.student?.name ?? null,
    submittedAt: s.submittedAt,
    fileUrl: s.fileUrl,
    text: s.textContent,
    late: s.submittedAt > assignment.dueDate,
    grade: s.grade,
    feedback: s.feedback,
    version: s.version,
  }));

  return NextResponse.json(result);
}

