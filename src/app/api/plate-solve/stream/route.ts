import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const PLATE_SOLVE_URL = process.env.PLATE_SOLVE_URL ?? 'http://127.0.0.1:8600';
const MEMBER_ROLES = ['MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!dbUser || !MEMBER_ROLES.includes(dbUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append('file', file, (file as File).name ?? 'image.jpg');
  for (const key of ['ra', 'dec', 'radius', 'scale_low', 'scale_high', 'downsample', 'objs']) {
    const val = formData.get(key);
    if (val !== null) upstream.append(key, String(val));
  }

  let res: Response;
  try {
    res = await fetch(`${PLATE_SOLVE_URL}/solve/stream`, {
      method: 'POST',
      body: upstream,
      signal: AbortSignal.timeout(130_000),
    });
  } catch (err) {
    console.error('[plate-solve/stream] upstream error:', err);
    return NextResponse.json({ error: 'Plate solve service unavailable' }, { status: 503 });
  }

  // Stream the SSE response straight through to the client.
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
