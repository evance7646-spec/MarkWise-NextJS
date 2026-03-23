/**
 * PATCH /api/student/push-token
 *
 * Upserts a device FCM token for the authenticated student.
 * Supports multi-device: each (studentId, fcmToken) pair is stored separately.
 * Body: { fcmToken: string }  (also accepts pushToken for backwards-compat)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyStudentAccessToken } from '@/lib/studentAuthJwt';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function PATCH(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  let studentId: string;
  try {
    ({ studentId } = verifyStudentAccessToken(token));
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders });
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: { fcmToken?: string; pushToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
  }

  const fcmToken = (body.fcmToken ?? body.pushToken ?? '').trim();
  if (!fcmToken) {
    return NextResponse.json({ error: 'fcmToken is required' }, { status: 422, headers: corsHeaders });
  }

  // ── Upsert into StudentPushToken (composite unique: studentId + fcmToken) ───────
  await prisma.studentPushToken.upsert({
    where: { studentId_fcmToken: { studentId, fcmToken } },
    update: { updatedAt: new Date() },
    create: { studentId, fcmToken },
  });

  // Also keep the legacy single-token column in sync for any code still reading it
  await prisma.student.update({
    where: { id: studentId },
    data: { pushToken: fcmToken },
  }).catch(() => {/* non-fatal */});

  return NextResponse.json({}, { headers: corsHeaders });
}

