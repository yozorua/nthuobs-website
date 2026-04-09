import { PrismaClient } from '@prisma/client';
import { WindStats } from './types';

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export async function calcWindStats(
  db: PrismaClient,
  consoleTime: Date,
  currentWindSpeed: number | null,
): Promise<WindStats> {
  const stats: WindStats = {
    avgWind1MinMs: null,
    avgWind10MinMs: null,
    hiWind10MinMs: null,
  };

  try {
    const tenMinAgo = new Date(consoleTime.getTime() - 10 * 60 * 1000);
    const oneMinAgo = new Date(consoleTime.getTime() - 60 * 1000);

    const rows10 = await db.weatherReading.findMany({
      where: { consoleTime: { gte: tenMinAgo } },
      select: { windSpeedMs: true },
      orderBy: { consoleTime: 'asc' },
    });

    const speeds10 = rows10
      .map(r => r.windSpeedMs)
      .filter((v): v is number => v !== null);
    if (currentWindSpeed !== null) speeds10.push(currentWindSpeed);

    if (speeds10.length > 0) {
      stats.avgWind10MinMs = mean(speeds10);
      stats.hiWind10MinMs = Math.max(...speeds10);
    }

    const speeds1 = rows10
      .filter(r => r.windSpeedMs !== null)
      .slice(-4) // approximately last 1 minute at 15s intervals
      .map(r => r.windSpeedMs as number);
    // Cross-check with 1-min query for accuracy
    const rows1 = await db.weatherReading.findMany({
      where: { consoleTime: { gte: oneMinAgo } },
      select: { windSpeedMs: true },
    });
    const speeds1min = rows1
      .map(r => r.windSpeedMs)
      .filter((v): v is number => v !== null);
    if (currentWindSpeed !== null) speeds1min.push(currentWindSpeed);
    void speeds1; // suppress unused variable

    if (speeds1min.length > 0) {
      stats.avgWind1MinMs = mean(speeds1min);
    }
  } catch (err) {
    console.error('[CALC] Wind stats error:', (err as Error).message);
  }

  return stats;
}
