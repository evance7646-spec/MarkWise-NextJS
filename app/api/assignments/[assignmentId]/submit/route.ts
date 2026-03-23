import { NextResponse, type NextRequest } from 'next/server';
import { verifyStudentAccessToken } from '@/lib/studentAuthJwt';
import { prisma } from '@/lib/prisma';
import { isStudentEnrolledForUnit } from '@/lib/enrollmentStore';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// POST /api/assignments/:assignmentId/submit — Submit or resubmit assignment (student)
export async function POST(req: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await context.params;
  const token =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ??
    new URL(req.url).searchParams.get('token') ?? '';

  let studentId: string;
  try {
    const s = verifyStudentAccessToken(token);
    // Support legacy tokens that store the student UUID as 'id' instead of 'studentId'
    studentId = s.studentId ?? (s as any).id;
    if (!studentId) throw new Error('no studentId');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404, headers: corsHeaders });

  const enrolled = await isStudentEnrolledForUnit(studentId, assignment.unitId);
  if (!enrolled) return NextResponse.json({ error: 'Not enrolled in unit' }, { status: 403, headers: corsHeaders });

  // Check for existing submission
  const existing = await prisma.submission.findFirst({
    where: { assignmentId, studentId },
    orderBy: { version: 'desc' },
  });

  const now = new Date();
  const isLate = now > assignment.dueDate;

  if (existing) {
    // Resubmission: only allowed before deadline and if not yet graded
    if (isLate) {
      return NextResponse.json({ error: 'Deadline has passed — resubmission not allowed' }, { status: 409, headers: corsHeaders });
    }
    if (existing.grade !== null) {
      return NextResponse.json({ error: 'Already graded — resubmission not allowed' }, { status: 409, headers: corsHeaders });
    }
  }

  const contentType = req.headers.get('content-type') ?? '';
  let fileUrl: string | null = null;
  let textContent: string | null = null;
  let groupId: string | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    // File is received as a URL string (actual upload handled by client-side storage)
    fileUrl = (formData.get('fileUrl') as string) ?? null;
    textContent = (formData.get('text') as string) ?? null;
    groupId = (formData.get('groupId') as string) ?? null;
  } else {
    const body = await req.json();
    fileUrl = body.fileUrl ?? null;
    textContent = body.text ?? body.textContent ?? null;
    groupId = body.groupId ?? null;
  }

  if (!fileUrl && !textContent) {
    return NextResponse.json({ error: 'fileUrl or text is required' }, { status: 400, headers: corsHeaders });
  }

  const version = existing ? existing.version + 1 : 1;

  const submission = await prisma.submission.create({
    data: {
      assignmentId,
      studentId,
      groupId: groupId ?? null,
      fileUrl,
      textContent,
      submittedAt: now,
      version,
      status: 'submitted',
    },
  });

  return NextResponse.json({
    id: submission.id,
    assignmentId: submission.assignmentId,
    studentId: submission.studentId,
    submittedAt: submission.submittedAt,
    fileUrl: submission.fileUrl,
    late: isLate,
    version: submission.version,
  }, { status: 201 });
}

