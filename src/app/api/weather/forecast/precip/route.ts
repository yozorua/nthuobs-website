import { NextResponse } from "next/server";

// CWA F-C0032-001: 36-hour city-level forecast
// Provides 12-hourly precipitation probability (PoP) for 新竹市
const API_KEY =
  process.env.CWA_API_KEY ?? "CWA-F5338160-CB8F-4878-A2E5-B686D2860F95";
const CWA_URL =
  `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001` +
  `?Authorization=${API_KEY}&locationName=新竹市&elementName=PoP`;

export interface PrecipPeriod {
  start: string; // ISO-8601 e.g. "2026-04-15T12:00:00+08:00"
  end: string;
  pop: number;   // 0-100
}

let cache: PrecipPeriod[] | null = null;
let cacheTs = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET() {
  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL_MS) {
    return NextResponse.json({ periods: cache });
  }

  try {
    const res = await fetch(CWA_URL, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json() as Record<string, unknown>;
    const locationList =
      ((data?.records as Record<string, unknown>)?.location as Record<string, unknown>[]) ?? [];
    const hsinchu =
      locationList.find((l) => (l.locationName as string) === "新竹市") ?? locationList[0];

    const elements =
      (hsinchu?.weatherElement as Record<string, unknown>[] | undefined) ?? [];
    const popEl = elements.find((el) => (el.elementName as string) === "PoP");

    const timeEntries =
      (popEl?.time as Record<string, unknown>[] | undefined) ?? [];

    // "2026-05-11 18:00:00" → "2026-05-11T18:00:00+08:00"
    const toISO = (s: string) => s.replace(" ", "T") + "+08:00";

    const periods: PrecipPeriod[] = timeEntries.flatMap((entry) => {
      const startRaw = (entry.startTime as string) ?? "";
      const endRaw   = (entry.endTime   as string) ?? "";
      const param    = entry.parameter as Record<string, string> | undefined;
      const pop      = parseInt(param?.parameterName ?? "", 10);
      if (!startRaw || !endRaw || isNaN(pop)) return [];
      return [{ start: toISO(startRaw), end: toISO(endRaw), pop }];
    });

    cache = periods;
    cacheTs = now;
    return NextResponse.json({ periods });
  } catch (err) {
    console.error("[PRECIP]", (err as Error).message);
    return NextResponse.json({ periods: cache ?? [] });
  }
}
