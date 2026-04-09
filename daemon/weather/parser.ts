import { StationRaw, ParsedReading } from './types';

function toFloat(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Flatten all nested keys from the Davis JSON into a single map
function flatten(raw: StationRaw): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [, nested] of Object.entries(raw)) {
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      for (const [k, v] of Object.entries(nested as Record<string, unknown>)) {
        flat[k] = v;
      }
    }
  }
  return flat;
}

export function parseReading(raw: StationRaw): ParsedReading | null {
  const f = flatten(raw);

  const consoleTimeStr = toStr(f['consoleTime']);
  if (!consoleTimeStr) {
    console.error('[PARSE] Missing consoleTime');
    return null;
  }

  // Davis format: "YYYY-MM-DD HH:MM:SS"
  const consoleTime = new Date(consoleTimeStr.replace(' ', 'T') + '+08:00'); // Taiwan time (UTC+8)
  if (isNaN(consoleTime.getTime())) {
    console.error(`[PARSE] Invalid consoleTime: ${consoleTimeStr}`);
    return null;
  }

  const stationDate = consoleTimeStr.slice(0, 10);         // "YYYY-MM-DD"
  const stationTime = consoleTimeStr.slice(11, 16);        // "HH:MM"

  return {
    consoleTime,
    stationDate,
    stationTime,

    outsideTempC: toFloat(f['outsideTempC']),
    insideTempC: toFloat(f['insideTempC']),
    outsideHumidityPercent: toFloat(f['outsideHumidityPercent']),
    insideHumidityPercent: toFloat(f['insideHumidityPercent']),
    barometerHpa: toFloat(f['barometerHpa']),
    windSpeedMs: toFloat(f['windSpeedMs']),
    windDirectionDeg: toFloat(f['windDirectionDeg']),
    windDirectionText: toStr(f['windDirectionText']),
    windGustMs: toFloat(f['windGust10minMs']),
    windGustDirDeg: toFloat(f['windGust10minDirDeg']),
    rainRateMmHr: toFloat(f['rainRateMmHr']),
    dailyRainMm: toFloat(f['dailyRainMm']),
    stormRainMm: toFloat(f['stormRainMm']),
    monthlyRainMm: toFloat(f['monthlyRainMm']),
    yearlyRainMm: toFloat(f['yearlyRainMm']),
    lastHourRainMm: toFloat(f['lastHourRainMm']),
    last15MinRainMm: toFloat(f['last15minRainMm']),
    last24hrRainMm: toFloat(f['last24hrRainMm']),
    dewpointC: toFloat(f['dewpointC']),
    heatIndexC: toFloat(f['heatIndexC']),
    windChillC: toFloat(f['windChillC']),
    thswIndexC: toFloat(f['thswIndexC']),
    consoleBatteryV: toFloat(f['consoleBatteryV']),
    avgWind2minMs: toFloat(f['avgWind2minMs']),

    outTempDayHighC: toFloat(f['outTempDayHighC']),
    outTempDayLowC: toFloat(f['outTempDayLowC']),
    inTempDayHighC: toFloat(f['inTempDayHighC']),
    inTempDayLowC: toFloat(f['inTempDayLowC']),
    baroDayHighHpa: toFloat(f['baroDayHighHpa']),
    baroDayLowHpa: toFloat(f['baroDayLowHpa']),
    windDayHighMs: toFloat(f['windDayHighMs']),
    windMonthHighMs: toFloat(f['windMonthHighMs']),
    windYearHighMs: toFloat(f['windYearHighMs']),
    windChillDayLowC: toFloat(f['windChillDayLowC']),
    heatIndexDayHighC: toFloat(f['heatIndexDayHighC']),
    rainRateDayHighMmHr: toFloat(f['rainRateDayHighMmHr']),
    rainRateHourHighMmHr: toFloat(f['rainRateHourHighMmHr']),

    sunrise: toStr(f['sunrise']),
    sunset: toStr(f['sunset']),
  };
}
