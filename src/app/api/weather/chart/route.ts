import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const hoursParam = req.nextUrl.searchParams.get("hours");
  const hours = Math.min(168, Math.max(1, Number(hoursParam ?? 12)));
  const since = new Date(Date.now() - hours * 3_600_000);

  try {
    const rows = await db.weatherReading.findMany({
      where: { scriptTimestamp: { gte: since } },
      select: {
        scriptTimestamp: true,
        consoleTime: true,
        outsideTempC: true,
        insideTempC: true,
        outsideHumidityPercent: true,
        insideHumidityPercent: true,
        barometerHpa: true,
        windSpeedMs: true,
        dailyRainMm: true,
        sqmMagPerArcsec2: true,
      },
      orderBy: { consoleTime: "asc" },
    });

    // Downsample to at most 500 points so large ranges (3d/7d) render instantly.
    // 7 days × 1-min intervals ≈ 10 080 rows → step ≈ 20 → ~504 pts
    const MAX_POINTS = 500;
    const step = Math.max(1, Math.ceil(rows.length / MAX_POINTS));
    let sampled: typeof rows;
    if (step <= 1) {
      sampled = rows;
    } else {
      // Bucket aggregation: keep max wind speed, last value for everything else.
      const buckets: typeof rows = [];
      for (let i = 0; i < rows.length; i += step) {
        const bucket = rows.slice(i, i + step);
        const last   = bucket[bucket.length - 1];
        const maxWind = bucket.reduce<number | null>((mx, r) => {
          if (r.windSpeedMs == null) return mx;
          return mx == null ? r.windSpeedMs : Math.max(mx, r.windSpeedMs);
        }, null);
        buckets.push({ ...last, windSpeedMs: maxWind });
      }
      sampled = buckets;
    }

    return NextResponse.json(sampled);
  } catch {
    return NextResponse.json({ error: "Failed to fetch chart data" }, { status: 500 });
  }
}
