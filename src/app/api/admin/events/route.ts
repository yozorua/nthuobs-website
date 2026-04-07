import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const events = await db.event.findMany({ orderBy: { date: 'asc' } });
  return NextResponse.json(events);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, description, date, location, isPublic } = await request.json();
  if (!title || !date) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const event = await db.event.create({
    data: { title, description: description || null, date: new Date(date), location: location || null, isPublic: isPublic ?? true },
  });
  return NextResponse.json(event, { status: 201 });
}
