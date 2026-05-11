import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { ALLSKY_IMAGE_PATH } from '@/config/observatory';

export async function GET() {
  try {
    const stat = await fs.stat(ALLSKY_IMAGE_PATH);
    return NextResponse.json(
      { mtime: stat.mtime.toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Image unavailable' }, { status: 503 });
  }
}
