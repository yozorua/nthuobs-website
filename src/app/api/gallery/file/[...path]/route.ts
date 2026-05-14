import { NextRequest, NextResponse } from 'next/server';
import { stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.tiff': 'image/tiff',
  '.mp4': 'video/mp4',
};

const GALLERY_DIR = join(process.cwd(), 'public', 'gallery');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const filePath = join(GALLERY_DIR, ...segments);

  // Security: prevent path traversal
  if (!filePath.startsWith(GALLERY_DIR + '/')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Only serve known media types
  const last = segments[segments.length - 1] ?? '';
  const ext = last.slice(last.lastIndexOf('.')).toLowerCase();
  const contentType = MIME_TYPES[ext];
  if (!contentType) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  let fileSize: number;
  let mtime: Date;
  try {
    const info = await stat(filePath);
    fileSize = info.size;
    mtime = info.mtime;
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  const makeStream = (start?: number, end?: number) => {
    const fs = createReadStream(filePath, start !== undefined ? { start, end } : undefined);
    return new ReadableStream({
      start(controller) {
        fs.on('data', (chunk) => controller.enqueue(chunk));
        fs.on('end', () => controller.close());
        fs.on('error', (err) => controller.error(err));
      },
      cancel() { fs.destroy(); },
    });
  };

  // Support Range requests so video seeking works
  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? Math.min(parseInt(match[2], 10), fileSize - 1) : fileSize - 1;
      return new NextResponse(makeStream(start, end), {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(end - start + 1),
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  }

  return new NextResponse(makeStream(), {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Last-Modified': mtime.toUTCString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
