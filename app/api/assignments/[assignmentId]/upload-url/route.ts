import { NextResponse, type NextRequest } from 'next/server';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { verifyStudentAccessToken } from '@/lib/studentAuthJwt';
import { prisma } from '@/lib/prisma';
import { isStudentEnrolledForUnit } from '@/lib/enrollmentStore';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** All MIME types accepted for assignment file submissions. */
export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'audio/mpeg',
  'video/mp4',
  'application/zip',
  'application/json',
] as const;

/** 100 MB — enforced both here and by the Vercel Blob token. */
const MAX_FILE_BYTES = 100 * 1024 * 1024;

export function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

/**
 * POST /api/assignments/:assignmentId/upload-url
 *
 * Step 1 of the presigned-upload flow.  The client sends the file metadata;
 * this endpoint validates it and returns a Vercel Blob client token the client
 * uses to PUT the file directly to Vercel Blob storage (bypassing Vercel's
 * 4.5 MB serverless body limit).
 *
 * Request body (JSON):
 *   { fileName: string, mimeType: string, fileSize?: number }
 *
 * Response:
 *   {
 *     clientToken: string,   // Vercel Blob client-upload token
 *     uploadUrl:   string,   // https://blob.vercel-storage.com/{pathname}
 *     pathname:    string,   // path inside the blob store
 *   }
 *
 * Step 2 — the client uploads the file:
 *   PUT {uploadUrl}
 *   Authorization: Bearer {clientToken}
 *   Content-Type: {mimeType}
 *   Body: binary file data
 *
 * Step 3 — after a successful upload Vercel Blob responds with the public
 * blob URL.  The client calls POST /api/assignments/:id/submit with JSON:
 *   { type: "file", fileUrl: "<blob-url>", fileName: "...", mimeType: "..." }
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId } = await context.params;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const token =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  let studentId: string;
  try {
    const s = verifyStudentAccessToken(token);
    studentId = s.studentId ?? (s as any).id;
    if (!studentId) throw new Error('no studentId');
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders },
    );
  }

  // ── Validate assignment ───────────────────────────────────────────────────
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment) {
    return NextResponse.json(
      { error: 'Assignment not found' },
      { status: 404, headers: corsHeaders },
    );
  }

  if (assignment.blockLate && new Date() > assignment.dueDate) {
    return NextResponse.json(
      { error: 'Late submissions are not allowed for this assignment' },
      { status: 403, headers: corsHeaders },
    );
  }

  const enrolled = await isStudentEnrolledForUnit(studentId, assignment.unitId);
  if (!enrolled) {
    return NextResponse.json(
      { error: 'Not enrolled in unit' },
      { status: 403, headers: corsHeaders },
    );
  }

  // ── Parse + validate file metadata ───────────────────────────────────────
  let body: { fileName?: string; mimeType?: string; fileSize?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders },
    );
  }

  const { fileName, mimeType, fileSize } = body;

  if (!fileName || !mimeType) {
    return NextResponse.json(
      { error: 'fileName and mimeType are required' },
      { status: 400, headers: corsHeaders },
    );
  }

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return NextResponse.json(
      { error: 'File type not allowed' },
      { status: 400, headers: corsHeaders },
    );
  }

  if (typeof fileSize === 'number' && fileSize > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: 'File too large (max 100 MB)' },
      { status: 413, headers: corsHeaders },
    );
  }

  // ── Generate Vercel Blob client token ─────────────────────────────────────
  const ext =
    fileName
      .split('.')
      .pop()
      ?.replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 10) ?? 'bin';
  const pathname = `assignments/${assignmentId}/${randomUUID()}.${ext}`;

  const clientToken = await generateClientTokenFromReadWriteToken({
    token: process.env.BLOB_READ_WRITE_TOKEN!,
    pathname,
    allowedContentTypes: [mimeType],
    maximumSizeInBytes: MAX_FILE_BYTES,
    // Token expires in 10 minutes — enough time for the client to upload
    validUntil: Date.now() + 10 * 60 * 1000,
  });

  return NextResponse.json(
    {
      clientToken,
      pathname,
      /**
       * The client should PUT the file to this URL with:
       *   Authorization: Bearer {clientToken}
       *   Content-Type: {mimeType}
       *
       * On success, Vercel Blob returns JSON with a `url` field — that is
       * the `fileUrl` to send to POST /api/assignments/:id/submit.
       *
       * Alternatively, use the @vercel/blob/client `upload()` helper which
       * wraps this request automatically.
       */
      uploadUrl: `https://blob.vercel-storage.com/${pathname}`,
    },
    { headers: corsHeaders },
  );
}
