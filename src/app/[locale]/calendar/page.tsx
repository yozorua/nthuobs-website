import { db } from '@/lib/db';
import { setRequestLocale } from 'next-intl/server';
import CalendarClient from '@/components/CalendarClient';

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const events = await db.event.findMany({
    where: { isPublic: true },
    orderBy: { date: 'asc' },
    select: { id: true, title: true, description: true, date: true, location: true },
  });

  const entries = events.map(e => ({
    id: e.id,
    title: e.title,
    date: e.date.toISOString(),
    description: e.description ?? undefined,
    location: e.location ?? undefined,
    type: 'event' as const,
  }));

  return <CalendarClient entries={entries} />;
}
