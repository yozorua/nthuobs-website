import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const PLATE_SOLVE_URL = process.env.PLATE_SOLVE_URL ?? 'http://127.0.0.1:8600';
const MEMBER_ROLES = ['MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/lib/db');
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

  // Forward to local plate-solve service
  const upstream = new FormData();
  upstream.append('file', file, (file as File).name ?? 'image.jpg');

  for (const key of ['ra', 'dec', 'radius', 'scale_low', 'scale_high']) {
    const val = formData.get(key);
    if (val !== null) upstream.append(key, String(val));
  }

  let res: Response;
  try {
    res = await fetch(`${PLATE_SOLVE_URL}/solve`, {
      method: 'POST',
      body: upstream,
      signal: AbortSignal.timeout(130_000),
    });
  } catch (err) {
    console.error('[plate-solve] upstream error:', err);
    return NextResponse.json({ error: 'Plate solve service unavailable' }, { status: 503 });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: res.ok ? 200 : res.status });
}
