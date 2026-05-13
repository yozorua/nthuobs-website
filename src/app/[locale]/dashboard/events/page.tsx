import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import EventsClient from '@/components/events/EventsClient';

const memberRoles = ['MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'];

export default async function DashboardEventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  const { locale } = await params;

  if (!session?.user) redirect(`/${locale}`);

  const dbRole = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!dbRole || !memberRoles.includes(dbRole.role)) redirect(`/${locale}/activate`);

  const userId = session.user.id!;
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  // Current time in Taiwan (UTC+8) as "HH:MM"
  const nowTaipei = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const nowTaipeiMins = nowTaipei.getUTCHours() * 60 + nowTaipei.getUTCMinutes();
  const todayUTC = startOfToday.toISOString().slice(0, 10);

  const [upcomingRaw, pastParticipations] = await Promise.all([
    db.event.findMany({
      where: { date: { gte: startOfToday } },
      orderBy: { date: 'asc' },
      include: {
        _count: { select: { participations: true } },
        participations: { where: { userId }, select: { id: true } },
      },
    }),
    db.eventParticipation.findMany({
      where: { userId, event: { date: { lt: startOfToday } } },
      orderBy: { event: { date: 'desc' } },
      include: {
        event: {
          include: { _count: { select: { participations: true } } },
        },
      },
    }),
  ]);

  // Split today's events that have already ended into history
  const isEndedToday = (ev: { date: Date; endTime: string | null }) => {
    const evDate = ev.date.toISOString().slice(0, 10);
    if (evDate !== todayUTC || !ev.endTime) return false;
    const [h, m] = ev.endTime.split(':').map(Number);
    return h * 60 + m <= nowTaipeiMins;
  };

  const upcomingEvents = upcomingRaw.filter(ev => !isEndedToday(ev));
  const endedTodayParticipated = upcomingRaw
    .filter(ev => isEndedToday(ev) && ev.participations.length > 0);

  const upcoming = upcomingEvents.map(ev => ({
    id: ev.id,
    title: ev.title,
    description: ev.description,
    date: ev.date.toISOString(),
    startTime: ev.startTime,
    endTime: ev.endTime,
    location: ev.location,
    isPublic: ev.isPublic,
    maxParticipants: ev.maxParticipants,
    estimatedVisitors: ev.estimatedVisitors,
    participantCount: ev._count.participations,
    participating: ev.participations.length > 0,
  }));

  const endedTodayHistory = endedTodayParticipated.map(ev => ({
    id: ev.id,
    title: ev.title,
    description: ev.description,
    date: ev.date.toISOString(),
    startTime: ev.startTime,
    endTime: ev.endTime,
    location: ev.location,
    isPublic: ev.isPublic,
    maxParticipants: ev.maxParticipants,
    estimatedVisitors: ev.estimatedVisitors,
    participantCount: ev._count.participations,
    participating: true,
  }));

  const history = [
    ...endedTodayHistory,
    ...pastParticipations.map(p => ({
      id: p.event.id,
      title: p.event.title,
      description: p.event.description,
      date: p.event.date.toISOString(),
      startTime: p.event.startTime,
      endTime: p.event.endTime,
      location: p.event.location,
      isPublic: p.event.isPublic,
      maxParticipants: p.event.maxParticipants,
      estimatedVisitors: p.event.estimatedVisitors,
      participantCount: p.event._count.participations,
      participating: true,
    })),
  ];

  const t = await getTranslations({ locale, namespace: 'events' });

  const translations = {
    upcomingTab: t('upcomingTab'),
    historyTab: t('historyTab'),
    noUpcoming: t('noUpcoming'),
    noHistory: t('noHistory'),
    participate: t('participate'),
    withdraw: t('withdraw'),
    full: t('full'),
    registered: t('registered'),
    participants: t('participants'),
    details: t('details'),
    hideDetails: t('hideDetails'),
    time: t('time'),
    location: t('location'),
    estimatedVisitors: t('estimatedVisitors'),
    alsoJoining: t('alsoJoining'),
    noOthers: t('noOthers'),
    loadingParticipants: t('loadingParticipants'),
  };

  return (
    <div className="page-enter max-w-4xl mx-auto px-6 pt-8 pb-16">
      <div className="mb-10 pb-8 flex items-center justify-between" style={{ borderBottom: '1px solid var(--line)' }}>
        <div>
          <p className="label mb-3">{t('label')}</p>
          <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
            {t('title')}
          </h1>
        </div>
        <Link href={`/${locale}/dashboard`} className="text-xs tracking-ultra uppercase hover-link">
          ← {t('back')}
        </Link>
      </div>

      <EventsClient upcoming={upcoming} history={history} locale={locale} t={translations} />
    </div>
  );
}
