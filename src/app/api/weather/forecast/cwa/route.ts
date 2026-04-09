import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const CACHE_PATH = path.join(process.cwd(), "daemon/weather/cache/cwa.json");

interface CwaLocation {
  LocationName?: string;
  WeatherElement?: Array<{
    ElementName?: string;
    Time?: Array<{
      StartTime?: string;
      EndTime?: string;
      Parameter?: Array<{ ParameterName?: string; ParameterValue?: string }>;
    }>;
  }>;
}

export async function GET() {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf-8");
    const json = JSON.parse(raw);

    // Navigate the CWA response structure
    const locations: CwaLocation[] =
      json?.cwaopendata?.Dataset?.Locations?.Location ?? [];

    // Find Hsinchu city forecast
    const hsinchu = locations.find(
      (loc) =>
        loc.LocationName === "新竹市" || loc.LocationName === "Hsinchu City",
    ) ?? locations[0];

    if (!hsinchu) {
      return NextResponse.json({ forecast: [] });
    }

    // Extract weather description elements
    const wxElement = (hsinchu.WeatherElement ?? []).find(
      (el) => el.ElementName === "Wx" || el.ElementName === "天氣現象",
    );

    const periods = (wxElement?.Time ?? []).map((t) => ({
      start: t.StartTime,
      end: t.EndTime,
      description:
        t.Parameter?.find((p) => p.ParameterName === "天氣現象" || p.ParameterName === "Weather")
          ?.ParameterValue ?? "",
      code:
        t.Parameter?.find((p) => p.ParameterName === "天氣代碼" || p.ParameterName === "Weather Code")
          ?.ParameterValue ?? "",
    }));

    return NextResponse.json({ location: hsinchu.LocationName, forecast: periods });
  } catch {
    return NextResponse.json({ error: "CWA forecast unavailable" }, { status: 503 });
  }
}
