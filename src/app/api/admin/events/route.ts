import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const canManageEvents = (role?: string) => ['ADMIN', 'MANAGER'].includes(role ?? '');

export async function GET() {
  const session = await auth();
  if (!canManageEvents((session?.user as { role?: string })?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const events = await db.event.findMany({
    orderBy: { date: 'asc' },
    include: { _count: { select: { participations: true } } },
  });

  return NextResponse.json(events.map(ev => ({
    ...ev,
    participantCount: ev._count.participations,
  })));
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!canManageEvents((session?.user as { role?: string })?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, description, date, startTime, endTime, location, isPublic, maxParticipants, estimatedVisitors } = await request.json();
  if (!title || !date) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const event = await db.event.create({
    data: {
      title,
      description: description || null,
      date: new Date(date),
      startTime: startTime || null,
      endTime: endTime || null,
      location: location || null,
      isPublic: isPublic ?? true,
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
      estimatedVisitors: estimatedVisitors ? parseInt(estimatedVisitors) : null,
    },
    include: { _count: { select: { participations: true } } },
  });

  return NextResponse.json({ ...event, participantCount: event._count.participations }, { status: 201 });
}
