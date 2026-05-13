import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const memberRoles = ['MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'];

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user?.id || !memberRoles.includes(role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: eventId } = await params;

  const participations = await db.eventParticipation.findMany({
    where: { eventId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          firstNameEn: true,
          lastNameEn: true,
          firstNameZh: true,
          lastNameZh: true,
          name: true,
          role: true,
          image: true,
        },
      },
    },
  });

  return NextResponse.json(participations.map(p => ({
    id: p.id,
    user: p.user,
  })));
}
