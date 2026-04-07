import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const VALID_ROLES = ['PENDING', 'MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { role } = await request.json();

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id },
    data: { role },
    select: { id: true, role: true },
  });

  return NextResponse.json(updated);
}
