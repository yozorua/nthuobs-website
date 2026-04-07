import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const canManageEvents = (role?: string) => ['ADMIN', 'MANAGER'].includes(role ?? '');

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canManageEvents((session?.user as { role?: string })?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { title, description, date, location, isPublic } = await request.json();

  const event = await db.event.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(location !== undefined && { location }),
      ...(isPublic !== undefined && { isPublic }),
    },
  });
  return NextResponse.json(event);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canManageEvents((session?.user as { role?: string })?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  await db.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
