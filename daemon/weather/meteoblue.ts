import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import { SEEING_FORECAST_URL, METEOBLUE_CACHE } from './config';
import { MeteoblueForecastEntry, ForecastData } from './types';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

export async function updateMeteoblueCache(): Promise<void> {
  console.log('[METEOBLUE] Fetching seeing forecast...');
  try {
    const res = await fetch(SEEING_FORECAST_URL, {
      headers: HEADERS,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error(`[METEOBLUE] HTTP ${res.status}`);
      return;
    }
    const html = await res.text();
    const data = parseMeteoblueHtml(html);
    if (!data || data.length === 0) {
      console.warn('[METEOBLUE] No forecast entries parsed');
      return;
    }
    await fs.writeFile(METEOBLUE_CACHE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[METEOBLUE] Saved ${data.length} entries to cache`);
  } catch (err) {
    console.error('[METEOBLUE] Error:', (err as Error).message);
  }
}

function parseMeteoblueHtml(html: string): MeteoblueForecastEntry[] {
  const $ = cheerio.load(html);
  const table = $('table.table-seeing');
  if (!table.length) {
    console.error('[METEOBLUE] Could not find table.table-seeing');
    return [];
  }

  const entries: MeteoblueForecastEntry[] = [];
  let currentDate = '';
  let moonrise = 'N/A';
  let moonset = 'N/A';
  let moonphase = 'N/A';

  table.find('tbody tr').each((_, row) => {
    const $row = $(row);
    const newDayCell = $row.find('td.new-day');

    if (newDayCell.length) {
      const dateText = newDayCell.text().trim();
      const words = dateText.split(/\s+/);
      let parsedDate = '';
      for (const word of words) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(word.trim())) {
          parsedDate = word.trim();
          break;
        }
      }
      if (!parsedDate) return; // skip header rows

      currentDate = parsedDate;
      moonrise = 'N/A';
      moonset = 'N/A';
      moonphase = 'N/A';

      const pre = newDayCell.find('pre').text().trim();
      if (pre) {
        const parts = pre.split(/\s+/);
        const mrIdx = parts.indexOf('moonrise:');
        if (mrIdx !== -1 && parts[mrIdx + 1]) moonrise = parts[mrIdx + 1];
        const msIdx = parts.indexOf('moonset:');
        if (msIdx !== -1 && parts[msIdx + 1]) moonset = parts[msIdx + 1];
        const mpIdx = parts.indexOf('moonphase:');
        if (mpIdx !== -1 && parts[mpIdx + 1]) moonphase = parts[mpIdx + 1];
      }
      return; // new-day rows don't have hourly data
    }

    const timeCell = $row.find('td.time');
    if (!timeCell.length) return;

    const timeText = timeCell.text().trim(); // "00:00"
    const hour = String(parseInt(timeText.split(':')[0], 10)); // "0", "1", ...

    const cells = $row.find('td').toArray();
    let timeCellIndex = -1;
    for (let i = 0; i < cells.length; i++) {
      if ($(cells[i]).hasClass('time')) { timeCellIndex = i; break; }
    }

    if (timeCellIndex === -1 || cells.length <= timeCellIndex + 4) return;

    const cloudsLow = $(cells[timeCellIndex + 1]).text().trim();
    const cloudsMid = $(cells[timeCellIndex + 2]).text().trim();
    const cloudsHigh = $(cells[timeCellIndex + 3]).text().trim();
    const seeing = $(cells[timeCellIndex + 4]).text().trim();

    entries.push({
      date: currentDate,
      time: hour,
      clouds_low: cloudsLow,
      clouds_mid: cloudsMid,
      clouds_high: cloudsHigh,
      seeing,
      moonrise,
      moonset,
      moonphase,
    });
  });

  return entries;
}

export async function matchForecast(
  stationDate: string,
  stationTime: string,
): Promise<ForecastData> {
  const empty: ForecastData = {
    cloudCoverHigh: null,
    cloudCoverMid: null,
    cloudCoverLow: null,
    seeing: null,
    moonrise: null,
    moonset: null,
    moonPhase: null,
  };

  try {
    const raw = await fs.readFile(METEOBLUE_CACHE, 'utf-8');
    const data = JSON.parse(raw) as MeteoblueForecastEntry[];
    const hour = String(parseInt(stationTime.split(':')[0], 10));
    const entry = data.find(e => e.date === stationDate && e.time === hour);
    if (!entry) return empty;

    return {
      cloudCoverHigh: toFloat(entry.clouds_high),
      cloudCoverMid: toFloat(entry.clouds_mid),
      cloudCoverLow: toFloat(entry.clouds_low),
      seeing: toFloat(entry.seeing),
      moonrise: entry.moonrise === 'N/A' ? null : entry.moonrise,
      moonset: entry.moonset === 'N/A' ? null : entry.moonset,
      moonPhase: entry.moonphase === 'N/A' ? null : entry.moonphase,
    };
  } catch {
    return empty;
  }
}

function toFloat(v: string): number | null {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}
