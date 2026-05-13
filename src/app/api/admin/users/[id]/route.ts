import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const VALID_ROLES = ['PENDING', 'MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'];
const isAdmin = (session: { user?: { role?: string } } | null) =>
  (session?.user as { role?: string })?.role === 'ADMIN';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const currentUserId = (session!.user as { id: string }).id;
  if (id === currentUserId) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });

  await db.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
