import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const CACHE_PATH = path.join(process.cwd(), "daemon/weather/cache/cwa.json");

export async function GET() {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf-8");
    const json = JSON.parse(raw);

    // F-C0032-024 returns a single Location object (not array)
    const locationRaw = json?.cwaopendata?.Dataset?.Locations?.Location;
    const location = Array.isArray(locationRaw) ? locationRaw[0] : locationRaw;

    if (!location) {
      return NextResponse.json({ forecast: [] });
    }

    // WeatherElement may be a single object or array; find the narrative description element
    const elementsRaw = location.WeatherElement;
    const elements = Array.isArray(elementsRaw) ? elementsRaw : [elementsRaw].filter(Boolean);

    const descElement = elements.find(
      (el: { ElementName?: string }) =>
        el?.ElementName === "天氣預報綜合描述" || el?.ElementName === "WeatherDescription",
    );

    // Descriptions are under ElementValue.WeatherDescription (array of strings)
    const descArray: string[] = descElement?.ElementValue?.WeatherDescription ?? [];

    const periods = descArray
      .filter((d: string) => typeof d === "string" && d.trim().length > 0)
      .map((description: string) => ({ description, code: "" }));

    return NextResponse.json({ location: location.LocationName, forecast: periods });
  } catch {
    return NextResponse.json({ error: "CWA forecast unavailable" }, { status: 503 });
  }
}
