import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const canManageEvents = (role?: string) => ['ADMIN', 'MANAGER'].includes(role ?? '');

const parseOptionalInt = (v: unknown) =>
  v === '' || v === null || v === undefined ? null : parseInt(v as string);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canManageEvents((session?.user as { role?: string })?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { title, description, date, startTime, endTime, location, isPublic, maxParticipants, estimatedVisitors } = await request.json();

  const event = await db.event.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(startTime !== undefined && { startTime: startTime || null }),
      ...(endTime !== undefined && { endTime: endTime || null }),
      ...(location !== undefined && { location }),
      ...(isPublic !== undefined && { isPublic }),
      ...(maxParticipants !== undefined && { maxParticipants: parseOptionalInt(maxParticipants) }),
      ...(estimatedVisitors !== undefined && { estimatedVisitors: parseOptionalInt(estimatedVisitors) }),
    },
    include: { _count: { select: { participations: true } } },
  });

  return NextResponse.json({ ...event, participantCount: event._count.participations });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canManageEvents((session?.user as { role?: string })?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  await db.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
