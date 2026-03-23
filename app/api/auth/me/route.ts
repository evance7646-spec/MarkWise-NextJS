import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuthToken } from '@/lib/adminAuthJwt';

// GET /api/auth/me
export async function GET(req: NextRequest) {
  // Try Authorization header first
  let token: string | undefined;
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace('Bearer ', '').trim();
  } else {
    // Fallback to HTTP-only cookie
    token = req.cookies.get('admin_auth_token')?.value;
  }
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated. Please provide token.' }, { status: 401 });
  }
  const payload = verifyAdminAuthToken(token);
  if (!payload || !payload.adminId) {
    return NextResponse.json({ error: 'Invalid or expired token', tokenSource: authHeader ? 'authorization' : 'cookie' }, { status: 401 });
  }
  const admin = await prisma.admin.findUnique({
    where: { id: payload.adminId },
    include: { department: true },
  });
  if (!admin) {
    return NextResponse.json({ error: 'Admin not found (token valid but user missing)' }, { status: 404 });
  }
  return NextResponse.json({
    id: admin.id,
    fullName: admin.fullName,
    email: admin.email,
    role: admin.role,
    institutionId: admin.institutionId,
    departmentId: admin.departmentId,
    department: admin.department ? { id: admin.department.id, name: admin.department.name } : null,
    authSource: authHeader ? 'authorization' : 'cookie',
  });
}
