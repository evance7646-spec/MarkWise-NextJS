import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/representatives?departmentId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get('departmentId');
  if (!departmentId) {
    return NextResponse.json({ error: 'departmentId is required' }, { status: 400 });
  }
  try {
    const reps = await prisma.representative.findMany({
      where: { departmentId },
      include: {
        student: true,
        department: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(reps);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch representatives' }, { status: 500 });
  }
}

// POST /api/representatives
export async function POST(req: NextRequest) {
  const data = await req.json();
  const { studentId, departmentId, term, position } = data;
  if (!studentId || !departmentId) {
    return NextResponse.json({ error: 'studentId and departmentId are required' }, { status: 400 });
  }
  try {
    const rep = await prisma.representative.create({
      data: { studentId, departmentId, term, position },
    });
    return NextResponse.json(rep, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create representative' }, { status: 500 });
  }
}

// DELETE /api/representatives?id=xxx
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  try {
    await prisma.representative.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete representative' }, { status: 500 });
  }
}
