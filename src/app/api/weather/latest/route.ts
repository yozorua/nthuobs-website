import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const reading = await db.weatherReading.findFirst({
      orderBy: { consoleTime: "desc" },
    });
    if (!reading) {
      return NextResponse.json({ error: "No data available" }, { status: 404 });
    }

    // Compute today's humidity H/L from the DB (grouped by stationDate).
    // The station's day H/L for humidity is not transmitted by the console,
    // so we derive it by aggregating all readings for the current station-date.
    const humidStats = await db.weatherReading.aggregate({
      where: { stationDate: reading.stationDate },
      _max: {
        outsideHumidityPercent: true,
        insideHumidityPercent:  true,
      },
      _min: {
        outsideHumidityPercent: true,
        insideHumidityPercent:  true,
      },
    });

    // Highest wind speed in the trailing 24 hours (rolling window, not calendar day).
    // Uses windSpeedMs — the same field the Data Trend chart bars are maxed from —
    // so this stat is always consistent with what the chart shows.
    const windStats = await db.weatherReading.aggregate({
      where: { consoleTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _max: { windSpeedMs: true },
    });

    return NextResponse.json({
      ...reading,
      outsideHumidityDayHigh: humidStats._max.outsideHumidityPercent,
      outsideHumidityDayLow:  humidStats._min.outsideHumidityPercent,
      insideHumidityDayHigh:  humidStats._max.insideHumidityPercent,
      insideHumidityDayLow:   humidStats._min.insideHumidityPercent,
      windSpeed24hHighMs:      windStats._max.windSpeedMs,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch latest reading" }, { status: 500 });
  }
}
