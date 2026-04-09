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
    return NextResponse.json(reading);
  } catch {
    return NextResponse.json({ error: "Failed to fetch latest reading" }, { status: 500 });
  }
}
