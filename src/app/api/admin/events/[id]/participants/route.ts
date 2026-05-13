import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const canManageEvents = (role?: string) => ['ADMIN', 'MANAGER'].includes(role ?? '');

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canManageEvents((session?.user as { role?: string })?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: eventId } = await params;

  const participations = await db.eventParticipation.findMany({
    where: { eventId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          firstNameEn: true,
          lastNameEn: true,
          firstNameZh: true,
          lastNameZh: true,
          email: true,
          role: true,
          image: true,
        },
      },
    },
  });

  return NextResponse.json(participations.map(p => ({
    id: p.id,
    registeredAt: p.createdAt,
    user: p.user,
  })));
}
