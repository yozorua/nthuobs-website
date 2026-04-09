import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import ProfileEditButton from '@/components/ProfileEditButton';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  const { locale } = await params;

  if (!session?.user) redirect(`/${locale}`);

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, firstNameEn: true, lastNameEn: true, firstNameZh: true, lastNameZh: true },
  });
  if (!dbUser || dbUser.role === 'PENDING') redirect(`/${locale}/activate`);

  const displayName = locale === 'tw'
    ? (dbUser.firstNameZh ?? session.user.name)
    : (dbUser.firstNameEn ?? session.user.name?.split(' ')[0]);

  const t = await getTranslations({ locale, namespace: 'dashboard' });

  const schedules = await db.schedule.findMany({
    where: { date: { gte: new Date() } },
    orderBy: { date: 'asc' },
    take: 5,
    include: { user: { select: { name: true } } },
  });

  const totalSchedules = await db.schedule.count();

  const roleKeyMap: Record<string, 'roleVisitor' | 'roleMember' | 'roleOperator' | 'roleManager'> = {
    PENDING: 'roleVisitor',
    MEMBER: 'roleMember',
    OPERATOR: 'roleOperator',
    MANAGER: 'roleManager',
    ADMIN: 'roleManager',
  };
  const roleDisplay = t(roleKeyMap[dbUser.role] ?? 'roleVisitor');

  const links = t.raw('links') as Array<{ label: string; desc: string }>;
  const linkHrefs = [
    `/${locale}/schedule`,
    `/${locale}/calendar`,
    `/${locale}/visit`,
    'mailto:nthuobs@gmail.com',
  ];

  const stats = [
    { label: t('totalSchedules'), value: totalSchedules },
    { label: t('upcomingSessions'), value: schedules.length },
    { label: t('role'), value: roleDisplay },
    { label: t('status'), value: t('active') },
  ];

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
      {/* Header */}
      <div className="mb-14 pb-8 flex items-end justify-between" style={{ borderBottom: '1px solid var(--line)' }}>
        <div>
          <p className="label mb-3">{t('label')}</p>
          <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
            {t('welcome')}, {displayName}
          </h1>
        </div>
        <ProfileEditButton />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-14" style={{ background: 'var(--line)' }}>
        {stats.map((s) => (
          <div key={s.label} className="px-6 py-5" style={{ background: 'var(--bg)' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--ink-faint)' }}>{s.label}</p>
            <p className="text-xl font-light" style={{ color: 'var(--ink)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Upcoming sessions */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <p className="label">{t('upcomingLabel')}</p>
            <Link
              href={`/${locale}/schedule`}
              className="hover-link text-xs"
            >
              {t('viewAll')}
            </Link>
          </div>

          {schedules.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{t('noSessions')}</p>
          ) : (
            <div className="space-y-px" style={{ background: 'var(--line)' }}>
              {schedules.map((s) => (
                <div key={s.id} className="px-5 py-4" style={{ background: 'var(--bg)' }}>
                  <p className="text-sm mb-1" style={{ color: 'var(--ink)' }}>{s.title}</p>
                  <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                    {new Date(s.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {' · '}
                    {s.startTime}–{s.endTime}
                  </p>
                  {s.user.name && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{s.user.name}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div>
          <p className="label mb-6">{t('quickLinks')}</p>
          <div className="space-y-px" style={{ background: 'var(--line)' }}>
            {links.map((link, i) => (
              <Link
                key={link.label}
                href={linkHrefs[i]}
                className="hover-bg block px-5 py-4"
              >
                <p className="text-sm mb-0.5" style={{ color: 'var(--ink)' }}>{link.label}</p>
                <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
