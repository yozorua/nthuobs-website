import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const CACHE_PATH = path.join(process.cwd(), "daemon/weather/cache/meteoblue.json");

export async function GET() {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Cloud forecast unavailable" }, { status: 503 });
  }
}
