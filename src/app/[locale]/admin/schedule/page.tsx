import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AdminScheduleClient from '@/components/admin/AdminScheduleClient';

export default async function AdminSchedulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  const { locale } = await params;

  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'ADMIN') redirect(`/${locale}/dashboard`);

  const [schedules, users] = await Promise.all([
    db.schedule.findMany({
      orderBy: { date: 'asc' },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    }),
    db.user.findMany({
      where: { role: { not: 'PENDING' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 py-16">
      <div className="mb-10 pb-8 flex items-center justify-between" style={{ borderBottom: '1px solid var(--line)' }}>
        <div>
          <p className="label mb-3">Administration · Schedule</p>
          <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
            Schedule Management
          </h1>
        </div>
        <Link href={`/${locale}/admin`} className="text-xs tracking-ultra uppercase hover-link">
          ← Back
        </Link>
      </div>
      <AdminScheduleClient initialSchedules={schedules} users={users} />
    </div>
  );
}
