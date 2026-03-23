import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; //  500 MB
export const MAX_FILE_BYTES  =  50 * 1024 * 1024; //   50 MB

export interface SavedFile {
  fileUrl: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Persist an uploaded Web API `File` to disk and return the URL the client
 * should use to access it.
 *
 * - Regular files  → `public/uploads/<uuid>.<ext>`  served at `/uploads/<uuid>.<ext>`
 * - Video files    → `public/uploads/videos/<uuid>.<ext>`  served at `/stream/<uuid>.<ext>`
 *   (the `/stream/:path*` rewrite in next.config.ts maps that to the Range-aware handler)
 *
 * Throws an error with a `.status` property (400 / 413) on invalid input, so
 * callers can forward it directly to the HTTP response.
 */
export async function saveUploadedFile(file: File): Promise<SavedFile> {
  if (file.size === 0) {
    throw Object.assign(new Error('Empty file'), { status: 400 });
  }

  const isVideo = file.type.startsWith('video/');
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;
  if (file.size > maxBytes) {
    const label = isVideo ? '500MB' : '50MB';
    throw Object.assign(new Error(`File too large (max ${label})`), { status: 413 });
  }

  const ext = (file.name ?? 'upload').split('.').pop() ?? 'bin';
  const filename = `${randomUUID()}.${ext}`;

  const uploadsDir = path.join(
    process.cwd(),
    'public',
    'uploads',
    ...(isVideo ? ['videos'] : []),
  );
  await fs.promises.mkdir(uploadsDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.promises.writeFile(path.join(uploadsDir, filename), buffer);

  // Videos: use the /stream/ path (served by the Range-aware API handler)
  // Other files: served directly as Next.js static assets under /uploads/
  const fileUrl = isVideo ? `/stream/${filename}` : `/uploads/${filename}`;

  return {
    fileUrl,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
  };
}
