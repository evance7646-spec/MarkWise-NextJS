import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/programs?departmentId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get('departmentId');
  if (!departmentId) {
    return NextResponse.json({ error: 'departmentId is required' }, { status: 400 });
  }
  try {
    // Find all programs for this department
    const programs = await prisma.program.findMany({
      where: { departmentId },
      include: {
        years: {
          include: {
            semesters: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ programs });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 });
  }
}
