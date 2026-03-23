import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyLecturerAccessToken } from '@/lib/lecturerAuthJwt';
import { saveUploadedFile } from '@/lib/fileStorage';

/** Accepts a UUID, a unit code, or a display string like "Unit Title (CODE)". Returns the Unit row or null. */
async function resolveUnit(param: string) {
  const byId = await prisma.unit.findUnique({ where: { id: param } });
  if (byId) return byId;
  let code = param.trim();
  const parenMatch = code.match(/\(([^)]+)\)\s*$/);
  if (parenMatch) code = parenMatch[1].trim();
  const byCode = await prisma.unit.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } },
  });
  if (byCode) return byCode;
  const normalised = code.replace(/\s+/g, '').toUpperCase();
  const byNormalised = await prisma.unit.findFirst({
    where: { code: { equals: normalised, mode: 'insensitive' } },
  });
  if (byNormalised) return byNormalised;
  // Final fallback: strip spaces from DB-side codes too (e.g. "SCH2180" matches stored "SCH 2180")
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Unit" WHERE REPLACE(UPPER(code), ' ', '') = ${normalised} LIMIT 1
  `;
  if (rows.length > 0) return prisma.unit.findUnique({ where: { id: rows[0].id } });
  return null;
}

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

// POST /api/units/:unitId/materials/bulk — Bulk create materials (assigned lecturer only)
// :unitId may be a UUID or a unit code such as "SCH 2180" / "SCH%202180"
export async function POST(req: NextRequest, context: { params: Promise<{ unitId: string }> }) {
  const { unitId: rawParam } = await context.params;
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  let lecturer: ReturnType<typeof verifyLecturerAccessToken>;
  try { lecturer = verifyLecturerAccessToken(token); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  // Resolve param to actual Unit row (supports both UUID and unit code)
  const unit = await resolveUnit(rawParam);
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  const unitId = unit.id;

  // Allow any lecturer belonging to the same institution as the unit's department
  const unitWithDept = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { department: { select: { institutionId: true } } },
  });
  const lecturerRow = await prisma.lecturer.findUnique({ where: { id: lecturer.lecturerId }, select: { institutionId: true } });
  if (!unitWithDept || !lecturerRow || unitWithDept.department.institutionId !== lecturerRow.institutionId) {
    return NextResponse.json({ error: 'Not authorised for this unit' }, { status: 403 });
  }

  let items: Array<{
    title: string; description?: string; fileUrl?: string; linkUrl?: string;
    textContent?: string; text?: string; type?: string; mimeType?: string; fileSize?: number;
  }> = [];

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    let i = 0;
    while (formData.has(`title_${i}`) || formData.has(`file_${i}`) || formData.has(`fileUrl_${i}`)) {
      let itemFileUrl: string | undefined = (formData.get(`fileUrl_${i}`) as string) ?? undefined;
      let itemMimeType: string | undefined = (formData.get(`mimeType_${i}`) as string) ?? undefined;
      let itemFileSize: number | undefined = undefined;
      // Handle binary file upload
      const fileField = formData.get(`file_${i}`) as File | null;
      if (fileField && fileField.size > 0 && !itemFileUrl) {
        try {
          const saved = await saveUploadedFile(fileField);
          itemFileUrl = saved.fileUrl;
          if (!itemMimeType) itemMimeType = saved.mimeType;
          itemFileSize = saved.fileSize;
        } catch (err: any) {
          return NextResponse.json({ error: `Item ${i}: ${err.message}` }, { status: err.status ?? 500 });
        }
      }
      items.push({
        title: (formData.get(`title_${i}`) as string) ?? `Upload ${i + 1}`,
        fileUrl: itemFileUrl,
        description: (formData.get(`description_${i}`) as string) ?? undefined,
        mimeType: itemMimeType,
        fileSize: itemFileSize,
        type: 'file',
      });
      i++;
    }
  } else {
    const body = await req.json();
    items = Array.isArray(body) ? body : (body.materials ?? []);
  }

  if (items.length === 0) {
    return NextResponse.json({ error: 'No materials provided' }, { status: 400 });
  }

  const created = await prisma.$transaction(
    items.map(item =>
      prisma.material.create({
        data: {
          unitId,
          lecturerId: lecturer.lecturerId,
          title: item.title,
          description: item.description ?? null,
          fileUrl: item.fileUrl ?? null,
          linkUrl: item.linkUrl ?? null,
          textContent: item.text ?? item.textContent ?? null,
          type: item.type ?? (item.fileUrl ? 'file' : item.linkUrl ? 'link' : 'text'),
          mimeType: item.mimeType ?? null,
          fileSize: item.fileSize ?? null,
        },
      })
    )
  );

  return NextResponse.json({ uploaded: created.length, materials: created.map(formatMaterial) }, { status: 201 });
}

