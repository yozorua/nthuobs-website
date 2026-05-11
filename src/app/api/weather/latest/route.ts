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

    return NextResponse.json({
      ...reading,
      outsideHumidityDayHigh: humidStats._max.outsideHumidityPercent,
      outsideHumidityDayLow:  humidStats._min.outsideHumidityPercent,
      insideHumidityDayHigh:  humidStats._max.insideHumidityPercent,
      insideHumidityDayLow:   humidStats._min.insideHumidityPercent,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch latest reading" }, { status: 500 });
  }
}
