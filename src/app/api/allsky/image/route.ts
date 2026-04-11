import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { ALLSKY_IMAGE_PATH } from '@/config/observatory';

export async function GET() {
  try {
    const buffer = await fs.readFile(ALLSKY_IMAGE_PATH);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Image unavailable' }, { status: 503 });
  }
}
