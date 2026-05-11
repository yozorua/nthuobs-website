import https from 'https';
import { PrismaClient } from '@prisma/client';
import { fetchStation } from './fetcher';
import { parseReading } from './parser';
import { matchForecast } from './meteoblue';
import { calcWindStats } from './calculations';
import { RETRY_COUNT, RETRY_DELAY_MS, ALLSKY_SQM_URL } from './config';
import { SqmData } from './types';

const SQM_AGENT = new https.Agent({ rejectUnauthorized: false });

function fetchSqm(): Promise<SqmData> {
  return new Promise((resolve) => {
    const req = https.get(ALLSKY_SQM_URL, { agent: SQM_AGENT }, (res) => {
      let raw = '';
      res.on('data', (chunk: string) => { raw += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw) as Record<string, unknown>;
          const sqmData = data?.camera_sqm_mag_data as Record<string, number> | undefined;
          resolve({ sqmMagPerArcsec2: sqmData?.last ?? null });
        } catch {
          resolve({ sqmMagPerArcsec2: null });
        }
      });
    });
    req.on('error', () => resolve({ sqmMagPerArcsec2: null }));
    req.setTimeout(5_000, () => { req.destroy(); resolve({ sqmMagPerArcsec2: null }); });
  });
}

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

    const forecast  = await matchForecast(parsed.stationDate, parsed.stationTime);
    const windStats = await calcWindStats(db, parsed.consoleTime, parsed.windSpeedMs);
    const sqmData   = await fetchSqm();

    try {
      await db.weatherReading.create({
        data: { ...parsed, ...forecast, ...windStats, ...sqmData },
      });
      console.log(`[STORE] OK  ${parsed.consoleTime.toISOString()}  OTemp=${parsed.outsideTempC}  Wind=${parsed.windSpeedMs}  Seeing=${forecast.seeing}  SQM=${sqmData.sqmMagPerArcsec2}`);
      return;
    } catch (err) {
      console.error('[STORE] DB error:', (err as Error).message);
      return;
    }
  }
}
