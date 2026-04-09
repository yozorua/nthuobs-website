import { PrismaClient } from '@prisma/client';
import { fetchStation } from './fetcher';
import { parseReading } from './parser';
import { matchForecast } from './meteoblue';
import { calcWindStats } from './calculations';
import { RETRY_COUNT, RETRY_DELAY_MS } from './config';

const db = new PrismaClient();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchAndStore(): Promise<void> {
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    if (attempt > 0) {
      console.log(`[STORE] Retry ${attempt}/${RETRY_COUNT}...`);
      await sleep(RETRY_DELAY_MS);
    }

    const raw = await fetchStation();
    if (!raw) { console.error('[STORE] No raw data. Skipping.'); return; }

    const parsed = parseReading(raw);
    if (!parsed) { console.error('[STORE] Parse failed. Skipping.'); return; }

    // Duplicate check
    const exists = await db.weatherReading.findUnique({
      where: { consoleTime: parsed.consoleTime },
      select: { id: true },
    });
    if (exists) {
      if (attempt < RETRY_COUNT) {
        console.log(`[STORE] Duplicate (${parsed.consoleTime.toISOString()}). Retrying...`);
        continue;
      }
      console.log('[STORE] Still duplicate after retries. Skipping cycle.');
      return;
    }

    const forecast = await matchForecast(parsed.stationDate, parsed.stationTime);
    const windStats = await calcWindStats(db, parsed.consoleTime, parsed.windSpeedMs);

    try {
      await db.weatherReading.create({
        data: { ...parsed, ...forecast, ...windStats },
      });
      console.log(`[STORE] OK  ${parsed.consoleTime.toISOString()}  OTemp=${parsed.outsideTempC}  Wind=${parsed.windSpeedMs}  Seeing=${forecast.seeing}`);
      return;
    } catch (err) {
      console.error('[STORE] DB error:', (err as Error).message);
      return;
    }
  }
}
