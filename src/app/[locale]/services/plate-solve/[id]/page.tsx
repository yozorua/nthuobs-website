import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import PlateSolveResult from '@/components/plate-solve/PlateSolveResult';

export const metadata: Metadata = { title: 'Astrometric Solution' };
export const dynamic = 'force-dynamic';

const PLATE_SOLVE_URL = process.env.PLATE_SOLVE_URL ?? 'http://127.0.0.1:8600';
const MEMBER_ROLES = ['MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'];

export interface SolveResultData {
  success: boolean;
  result_id: string;
  ra: number;
  dec: number;
  orientation: number;
  pixscale: number;
  parity: string;
  radius: number;
  width_deg: number;
  height_deg: number;
  solved_at: number;
  expires_at: number;
  has_image: boolean;
  is_fits: boolean;
  has_wcs: boolean;
  downsample: number;
  objs: number;
}

export default async function PlateSolveResultPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  // Auth check
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

  // Validate id format
  if (!/^[0-9a-f-]+$/.test(id)) notFound();

  // Fetch result from plate-solve service (server-side, localhost)
  let result: SolveResultData | null = null;
  let expired = false;

  try {
    const res = await fetch(`${PLATE_SOLVE_URL}/result/${id}`, {
      cache: 'no-store',
    });
    if (res.status === 404) {
      expired = true;
    } else if (res.ok) {
      result = await res.json();
    }
  } catch {
    // service unavailable — show expired state
    expired = true;
  }

  return (
    <PlateSolveResult
      result={result}
      expired={expired}
      isSignedIn={isSignedIn}
      isMember={isMember}
      locale={locale}
    />
  );
}
