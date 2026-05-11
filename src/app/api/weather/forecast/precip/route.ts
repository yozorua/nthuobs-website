import { NextResponse } from "next/server";

// CWA F-D0047-091: Hsinchu City township 3-day forecast
// Provides 6-hourly precipitation probability (PoP6h) for 東區 (East District),
// which covers the NTHU Observatory site.
const API_KEY =
  process.env.CWA_API_KEY ?? "CWA-F5338160-CB8F-4878-A2E5-B686D2860F95";
const CWA_URL =
  `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-091` +
  `?Authorization=${API_KEY}&locationName=東區&elementName=PoP6h`;

export interface PrecipPeriod {
  start: string; // ISO-8601 e.g. "2026-04-15T12:00:00+08:00"
  end: string;
  pop: number;   // 0-100
}

// Simple in-process cache — avoid hammering CWA on every page load
let cache: PrecipPeriod[] | null = null;
let cacheTs = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

export async function GET() {
  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL_MS) {
    return NextResponse.json({ periods: cache });
  }

  try {
    const res = await fetch(CWA_URL, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json() as Record<string, unknown>;

    // Navigate the CWA response tree:
    //   records.Locations[0].Location[0].WeatherElement[PoP6h].ElementValue
    const records = data?.records as Record<string, unknown> | undefined;
    const locationsArr = (records?.Locations as Record<string, unknown>[] | undefined)?.[0];
    const locationList = (locationsArr?.Location as Record<string, unknown>[] | undefined) ?? [];
    const location = locationList.find(
      (l) => (l.LocationName as string) === "東區"
    ) ?? locationList[0];

    const elements = (location?.WeatherElement as Record<string, unknown>[] | undefined) ?? [];
    const pop6hEl = elements.find(
      (el) => (el.ElementName as string) === "PoP6h"
    );
    const elementValues = (pop6hEl?.ElementValue as Record<string, unknown>[] | undefined) ?? [];

    const periods: PrecipPeriod[] = elementValues.flatMap((ev) => {
      const validTime = ev.ValidTime as Record<string, string> | undefined;
      const start = validTime?.StartTime ?? "";
      const end   = validTime?.EndTime   ?? "";
      if (!start || !end) return [];

      // Value can be an array; pick the PoP6h numeric field
      const valueArr = (ev.Value as Record<string, string>[] | undefined) ?? [];
      const raw = valueArr[0]?.PoP6h ?? valueArr[0]?.["PoP6h"] ?? "";
      const pop = parseInt(raw, 10);
      if (isNaN(pop)) return [];

      return [{ start, end, pop }];
    });

    cache = periods;
    cacheTs = now;
    return NextResponse.json({ periods });
  } catch (err) {
    console.error("[PRECIP]", (err as Error).message);
    // Return cached stale data if available, otherwise empty
    return NextResponse.json({ periods: cache ?? [] });
  }
}
