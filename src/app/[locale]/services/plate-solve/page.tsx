import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import PlateSolveClient from '@/components/plate-solve/PlateSolveClient';

export const metadata: Metadata = { title: 'Astrometric Solving' };

const MEMBER_ROLES = ['MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'];

export default async function PlateSolvePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  const isSignedIn = !!session?.user?.id;
  let isMember = false;

  if (isSignedIn) {
    const dbUser = await db.user.findUnique({
      where: { id: session!.user!.id as string },
      select: { role: true },
    });
    isMember = dbUser ? MEMBER_ROLES.includes(dbUser.role) : false;
  }

  return <PlateSolveClient isMember={isMember} isSignedIn={isSignedIn} locale={locale} />;
}
