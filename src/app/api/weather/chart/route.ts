import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const hoursParam = req.nextUrl.searchParams.get("hours");
  const hours = Math.min(168, Math.max(1, Number(hoursParam ?? 12)));
  const since = new Date(Date.now() - hours * 3_600_000);

  try {
    const rows = await db.weatherReading.findMany({
      where: { consoleTime: { gte: since } },
      select: {
        consoleTime: true,
        outsideTempC: true,
        insideTempC: true,
        outsideHumidityPercent: true,
        insideHumidityPercent: true,
        barometerHpa: true,
        windSpeedMs: true,
        dailyRainMm: true,
      },
      orderBy: { consoleTime: "asc" },
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to fetch chart data" }, { status: 500 });
  }
}
