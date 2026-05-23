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
  console.log('[dashboard] session.user.id:', session.user.id, 'session.user.email:', session.user.email, 'dbUser:', dbUser);
  if (!dbUser || dbUser.role === 'PENDING') redirect(`/${locale}/activate`);

  const displayName = locale === 'tw'
    ? (dbUser.firstNameZh ?? session.user.name)
    : (dbUser.firstNameEn ?? session.user.name?.split(' ')[0]);

  const t = await getTranslations({ locale, namespace: 'dashboard' });

  const userId = session.user.id!;
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const dateLocale = locale === 'tw' ? 'zh-TW' : 'en-GB';

  const nowTaipei = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const nowTaipeiMins = nowTaipei.getUTCHours() * 60 + nowTaipei.getUTCMinutes();
  const todayUTC = startOfToday.toISOString().slice(0, 10);

  const isEndedToday = (ev: { date: Date; endTime: string | null }) => {
    if (ev.date.toISOString().slice(0, 10) !== todayUTC || !ev.endTime) return false;
    const [h, m] = ev.endTime.split(':').map(Number);
    return h * 60 + m <= nowTaipeiMins;
  };

  const [schedules, totalSchedules, upcomingParticipations, totalEventsJoined] = await Promise.all([
    db.schedule.findMany({
      where: { date: { gte: startOfToday } },
      orderBy: { date: 'asc' },
      take: 5,
      include: { user: { select: { name: true } } },
    }),
    db.schedule.count(),
    db.eventParticipation.findMany({
      where: { userId, event: { date: { gte: startOfToday } } },
      orderBy: { event: { date: 'asc' } },
      include: {
        event: { select: { id: true, title: true, date: true, startTime: true, endTime: true, location: true } },
      },
    }),
    db.eventParticipation.count({ where: { userId } }),
  ]);

  const upcomingEvents = upcomingParticipations.filter(p => !isEndedToday(p.event)).slice(0, 3);

  const roleKeyMap: Record<string, 'roleVisitor' | 'roleMember' | 'roleOperator' | 'roleManager'> = {
    PENDING: 'roleVisitor',
    MEMBER: 'roleMember',
    OPERATOR: 'roleOperator',
    MANAGER: 'roleManager',
    ADMIN: 'roleManager',
  };
  const roleDisplay = t(roleKeyMap[dbUser.role] ?? 'roleVisitor');

  const isAdminOrManager = dbUser.role === 'ADMIN' || dbUser.role === 'MANAGER';
  const manageEventsLink = t.raw('manageEventsLink') as { label: string; desc: string };
  const baseLinks = t.raw('links') as Array<{ label: string; desc: string }>;
  const baseHrefs = [
    `/${locale}/schedule`,
    `/${locale}/dashboard/events`,
    `/${locale}/calendar`,
    `/${locale}/visit`,
    'mailto:nthuobs@gmail.com',
  ];
  const links = isAdminOrManager
    ? [manageEventsLink, ...baseLinks]
    : baseLinks;
  const linkHrefs = isAdminOrManager
    ? [`/${locale}/admin/events`, ...baseHrefs]
    : baseHrefs;

  const stats = [
    { label: t('role'), value: roleDisplay },
    { label: t('totalEvents'), value: totalEventsJoined },
    { label: t('upcomingEventsCount'), value: upcomingEvents.length },
    { label: t('totalSchedules'), value: totalSchedules },
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

      {/* Upcoming Events + Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
        <div>
          <div className="flex items-center justify-between mb-6">
            <p className="label">{t('upcomingEventsLabel')}</p>
            <Link href={`/${locale}/dashboard/events`} className="hover-link text-xs">{t('viewAll')}</Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{t('noEvents')}</p>
          ) : (
            <div className="space-y-px" style={{ background: 'var(--line)' }}>
              {upcomingEvents.map(({ event: ev }) => (
                <div key={ev.id} className="px-5 py-4" style={{ background: 'var(--bg)' }}>
                  <p className="text-sm mb-1" style={{ color: 'var(--ink)' }}>{ev.title}</p>
                  <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                    {new Date(ev.date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
                    {ev.startTime && ev.endTime && <span> · {ev.startTime}–{ev.endTime}</span>}
                  </p>
                  {ev.location && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--ink-faint)' }}>{ev.location}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="label mb-6">{t('quickLinks')}</p>
          <div className="space-y-px" style={{ background: 'var(--line)' }}>
            {links.map((link, i) => (
              <Link key={link.label} href={linkHrefs[i]} className="hover-bg block px-5 py-4">
                <p className="text-sm mb-0.5" style={{ color: 'var(--ink)' }}>{link.label}</p>
                <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming Sessions */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <p className="label">{t('upcomingLabel')}</p>
          <Link href={`/${locale}/schedule`} className="hover-link text-xs">{t('viewAll')}</Link>
        </div>
        {schedules.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{t('noSessions')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: 'var(--line)' }}>
            {schedules.map((s) => (
              <div key={s.id} className="px-5 py-4" style={{ background: 'var(--bg)' }}>
                <p className="text-sm mb-1" style={{ color: 'var(--ink)' }}>{s.title}</p>
                <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                  {new Date(s.date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}{s.startTime}–{s.endTime}
                </p>
                {s.user.name && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{s.user.name}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
