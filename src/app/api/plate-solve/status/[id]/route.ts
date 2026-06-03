import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const PLATE_SOLVE_URL = process.env.PLATE_SOLVE_URL ?? 'http://127.0.0.1:8600';
const MEMBER_ROLES = ['MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
  const { id } = await params;
  if (!/^[0-9a-f-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  try {
    const res = await fetch(`${PLATE_SOLVE_URL}/result/${id}/status`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 'not_found' });
  }
}
