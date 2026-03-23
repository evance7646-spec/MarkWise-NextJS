import { NextResponse, type NextRequest } from 'next/server';
import { verifyStudentAccessToken } from '@/lib/studentAuthJwt';
import { prisma } from '@/lib/prisma';

// GET /api/assignments/:assignmentId/submission — Student's own submission
export async function GET(req: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await context.params;
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  let student: ReturnType<typeof verifyStudentAccessToken>;
  try { student = verifyStudentAccessToken(token); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

  const submission = await prisma.submission.findFirst({
    where: { assignmentId, studentId: student.studentId },
    orderBy: { version: 'desc' },
  });
  if (!submission) return NextResponse.json({ error: 'No submission found' }, { status: 404 });

  return NextResponse.json({
    id: submission.id,
    assignmentId: submission.assignmentId,
    studentId: submission.studentId,
    submittedAt: submission.submittedAt,
    fileUrl: submission.fileUrl,
    text: submission.textContent,
    late: submission.submittedAt > assignment.dueDate,
    grade: submission.grade,
    feedback: submission.feedback,
    version: submission.version,
  });
}
