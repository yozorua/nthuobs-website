export interface WeatherReading {
  id: string;
  scriptTimestamp: string;
  consoleTime: string;
  stationDate: string;
  stationTime: string;

  outsideTempC: number | null;
  insideTempC: number | null;
  outsideHumidityPercent: number | null;
  insideHumidityPercent: number | null;
  barometerHpa: number | null;
  windSpeedMs: number | null;
  windDirectionDeg: number | null;
  windDirectionText: string | null;
  windGustMs: number | null;
  windGustDirDeg: number | null;
  rainRateMmHr: number | null;
  dailyRainMm: number | null;
  stormRainMm: number | null;
  monthlyRainMm: number | null;
  yearlyRainMm: number | null;
  lastHourRainMm: number | null;
  last15MinRainMm: number | null;
  last24hrRainMm: number | null;
  dewpointC: number | null;
  heatIndexC: number | null;
  windChillC: number | null;
  thswIndexC: number | null;
  consoleBatteryV: number | null;
  avgWind2minMs: number | null;

  outTempDayHighC: number | null;
  outTempDayLowC: number | null;
  inTempDayHighC: number | null;
  inTempDayLowC: number | null;
  baroDayHighHpa: number | null;
  baroDayLowHpa: number | null;
  windDayHighMs: number | null;
  windMonthHighMs: number | null;
  windYearHighMs: number | null;
  windChillDayLowC: number | null;
  heatIndexDayHighC: number | null;
  rainRateDayHighMmHr: number | null;
  rainRateHourHighMmHr: number | null;

  sunrise: string | null;
  sunset: string | null;

  avgWind1MinMs: number | null;
  avgWind10MinMs: number | null;
  hiWind10MinMs: number | null;

  cloudCoverHigh: number | null;
  cloudCoverMid: number | null;
  cloudCoverLow: number | null;
  seeing: number | null;
  moonrise: string | null;
  moonset: string | null;
  moonPhase: string | null;
}

export interface ChartRow {
  consoleTime: string;
  outsideTempC: number | null;
  insideTempC: number | null;
  outsideHumidityPercent: number | null;
  insideHumidityPercent: number | null;
  barometerHpa: number | null;
  windSpeedMs: number | null;
  dailyRainMm: number | null;
}

export interface MeteoblueForecastEntry {
  date: string;
  time: string;
  clouds_low: string;
  clouds_mid: string;
  clouds_high: string;
  seeing: string;
  moonrise: string;
  moonset: string;
  moonphase: string;
}

export interface CwaForecastPeriod {
  start?: string;
  end?: string;
  description: string;
  code: string;
}
