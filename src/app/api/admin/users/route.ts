import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, name: true, image: true, role: true, createdAt: true },
  });

  return NextResponse.json(users);
}
