import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const BIN_MS = 15 * 60_000;

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

    // Compute per-row rain deltas from the cumulative daily counter.
    // Negative delta = daily reset; treat remainder as rain since reset.
    const withDeltas = rows.map((r, i) => {
      const prev = i > 0 ? rows[i - 1]!.dailyRainMm : null;
      const cur  = r.dailyRainMm;
      let delta: number | null = null;
      if (cur != null) {
        delta = prev != null
          ? (cur - prev < 0 ? Math.max(0, cur) : cur - prev)
          : 0;
      }
      return { ...r, rainDelta: delta };
    });

    // Aggregate into 15-minute bins.
    const bins = new Map<number, typeof withDeltas>();
    for (const r of withDeltas) {
      const binKey = Math.floor(new Date(r.scriptTimestamp).getTime() / BIN_MS) * BIN_MS;
      if (!bins.has(binKey)) bins.set(binKey, []);
      bins.get(binKey)!.push(r);
    }

    const avg = (vals: (number | null)[]): number | null => {
      const v = vals.filter((x): x is number => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const max = (vals: (number | null)[]): number | null => {
      const v = vals.filter((x): x is number => x != null);
      return v.length ? Math.max(...v) : null;
    };
    const sum = (vals: (number | null)[]): number | null => {
      const v = vals.filter((x): x is number => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) : null;
    };

    const binned = [...bins.entries()]
      .sort(([a], [b]) => a - b)
      .map(([binKey, bRows]) => ({
        scriptTimestamp:        new Date(binKey).toISOString(),
        outsideTempC:           avg(bRows.map(r => r.outsideTempC)),
        insideTempC:            avg(bRows.map(r => r.insideTempC)),
        outsideHumidityPercent: avg(bRows.map(r => r.outsideHumidityPercent)),
        insideHumidityPercent:  avg(bRows.map(r => r.insideHumidityPercent)),
        barometerHpa:           avg(bRows.map(r => r.barometerHpa)),
        windSpeedMs:            max(bRows.map(r => r.windSpeedMs)),
        rainTotalMm:            sum(bRows.map(r => r.rainDelta)),
        sqmMagPerArcsec2:       avg(bRows.map(r => r.sqmMagPerArcsec2)),
      }));

    return NextResponse.json(binned);
  } catch {
    return NextResponse.json({ error: "Failed to fetch chart data" }, { status: 500 });
  }
}
