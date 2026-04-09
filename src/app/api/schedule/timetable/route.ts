import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// Night window: 18:00–08:00 Taiwan time (UTC+8)
// 18:00 UTC+8 = 10:00 UTC; 08:00 UTC+8 next day = 00:00 UTC next day

function nightUTCRange(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 10, 0, 0));        // 18:00 TW
  const end   = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));     // 08:00 TW next day
  return { start, end };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(1, parseInt(searchParams.get('days') || '4')), 7);

  // Current date in Taiwan time
  const twNow = new Date(Date.now() + 8 * 3600 * 1000);
  const results = [];

  for (let i = 0; i < days; i++) {
    const dayUTC = new Date(twNow);
    dayUTC.setUTCDate(dayUTC.getUTCDate() + i);
    const dateStr   = dayUTC.toISOString().split('T')[0];
    const [y, m, d] = dateStr.split('-').map(Number);
    const nextDateStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().split('T')[0];

    const { start: nightStart, end: nightEnd } = nightUTCRange(dateStr);

    // Astronomical data: grab the most recent reading whose stationDate matches
    const astro = await db.weatherReading.findFirst({
      where: { stationDate: dateStr },
      select: { sunrise: true, sunset: true, moonrise: true, moonset: true, moonPhase: true },
      orderBy: { consoleTime: 'desc' },
    });

    // Weather for this night (one sample per ~15 min is enough; cap at 200 rows)
    const allWeather = await db.weatherReading.findMany({
      where: { consoleTime: { gte: nightStart, lte: nightEnd } },
      select: {
        consoleTime: true,
        cloudCoverHigh: true,
        cloudCoverMid: true,
        cloudCoverLow: true,
        windSpeedMs: true,
        rainRateMmHr: true,
      },
      orderBy: { consoleTime: 'asc' },
    });

    // Downsample to at most one reading per 15-min bucket
    const bucketMap = new Map<number, (typeof allWeather)[0]>();
    for (const r of allWeather) {
      const t = new Date(r.consoleTime).getTime();
      const bucket = Math.floor(t / (15 * 60 * 1000));
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, r);
    }
    const weather = Array.from(bucketMap.values());

    // Schedules for this date (stored as UTC midnight = the YYYY-MM-DD string)
    const schedules = await db.schedule.findMany({
      where: {
        date: {
          gte: new Date(dateStr),
          lt:  new Date(nextDateStr),
        },
      },
      include: {
        user: { select: { id: true, name: true, firstNameEn: true, lastNameEn: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    results.push({
      date:       dateStr,
      nextDate:   nextDateStr,
      sunrise:    astro?.sunrise   ?? null,
      sunset:     astro?.sunset    ?? null,
      moonrise:   astro?.moonrise  ?? null,
      moonset:    astro?.moonset   ?? null,
      moonPhase:  astro?.moonPhase ?? null,
      weather,
      schedules: schedules.map(s => ({
        id:        s.id,
        title:     s.title,
        startTime: s.startTime,
        endTime:   s.endTime,
        telescope: s.telescope,
        userId:    s.userId,
        userName:  s.user.name ?? s.user.firstNameEn ?? 'Member',
      })),
    });
  }

  return NextResponse.json(results);
}
