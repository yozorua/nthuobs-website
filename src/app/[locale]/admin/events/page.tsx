import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import AdminEventsClient from '@/components/admin/AdminEventsClient';

export default async function AdminEventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  const { locale } = await params;

  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || !['ADMIN', 'MANAGER'].includes(role ?? '')) redirect(`/${locale}/dashboard`);

  const events = await db.event.findMany({
    orderBy: { date: 'asc' },
    include: { _count: { select: { participations: true } } },
  });

  const initialEvents = events.map(ev => ({
    ...ev,
    participantCount: ev._count.participations,
  }));

  const t = await getTranslations({ locale, namespace: 'adminEvents' });

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
      <div className="mb-10 pb-8 flex items-center justify-between" style={{ borderBottom: '1px solid var(--line)' }}>
        <div>
          <p className="label mb-3">{t('breadcrumb')}</p>
          <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
            {t('title')}
          </h1>
        </div>
        <Link href={`/${locale}/admin`} className="text-xs tracking-ultra uppercase hover-link">
          ← {t('back')}
        </Link>
      </div>
      <AdminEventsClient initialEvents={initialEvents} locale={locale} />
    </div>
  );
}
