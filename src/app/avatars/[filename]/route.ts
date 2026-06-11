import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

// Force dynamic so Next.js never caches this route — new avatar files must
// always be served fresh from disk without any Full Route Cache interference.
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // Reject anything that isn't a bare "id.jpg" or "id.png" to prevent
  // path traversal and unexpected content types.
  if (!/^[a-z0-9]+\.(jpg|png)$/i.test(filename)) {
    return new NextResponse(null, { status: 404 });
  }

  const filePath = join(process.cwd(), 'public', 'avatars', filename);

  try {
    const buffer = await readFile(filePath);
    const ext = extname(filename).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
