import { NextResponse } from "next/server";

function latestRadarTimestamp(offsetBack = 0): string {
  // Taiwan is UTC+8; radar images are updated every 10 min at :00, :10, ..., :50
  const now = new Date();
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000 - offsetBack * 10 * 60 * 1000);
  tw.setUTCMinutes(Math.floor(tw.getUTCMinutes() / 10) * 10, 0, 0);
  const y  = tw.getUTCFullYear();
  const mo = String(tw.getUTCMonth() + 1).padStart(2, '0');
  const d  = String(tw.getUTCDate()).padStart(2, '0');
  const h  = String(tw.getUTCHours()).padStart(2, '0');
  const mi = String(tw.getUTCMinutes()).padStart(2, '0');
  return `${y}${mo}${d}${h}${mi}`;
}

export async function GET() {
  // Try the last three 10-min slots in case the newest image isn't published yet
  for (let back = 0; back <= 3; back++) {
    const ts  = latestRadarTimestamp(back);
    const url = `https://www.cwa.gov.tw/Data/radar/CV1_TW_3600_${ts}.png`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=120',
          'X-Radar-Timestamp': ts,
        },
      });
    } catch {
      continue;
    }
  }
  return NextResponse.json({ error: "Radar unavailable" }, { status: 503 });
}
