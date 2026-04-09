'use client';

import { useTranslations } from 'next-intl';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceArea,
} from 'recharts';
import { ChartRow } from './types';

const HOURS_OPTIONS = [
  { label: '1h', value: 1 },
  { label: '3h', value: 3 },
  { label: '6h', value: 6 },
  { label: '12h', value: 12 },
  { label: '24h', value: 24 },
  { label: '2d', value: 48 },
  { label: '3d', value: 72 },
  { label: '7d', value: 168 },
];

interface Props {
  data: ChartRow[];
  hours: number;
  onHoursChange: (h: number) => void;
  sunrise?: string | null;
  sunset?: string | null;
}

function formatTime(iso: string, hours: number): string {
  const d = new Date(iso);
  if (hours <= 24) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

// Build night-shade reference areas from sunrise/sunset strings
function buildNightAreas(data: ChartRow[], sunrise?: string | null, sunset?: string | null) {
  if (!sunrise || !sunset || data.length === 0) return [];

  const riseMin = toMin(sunrise);
  const setMin = toMin(sunset);
  const areas: Array<{ x1: string; x2: string }> = [];

  // Group data by date
  const dates = [...new Set(data.map(r => r.consoleTime.slice(0, 10)))];
  for (const date of dates) {
    const dayRows = data.filter(r => r.consoleTime.startsWith(date));
    if (!dayRows.length) continue;

    const firstTs = dayRows[0].consoleTime;
    const lastTs = dayRows[dayRows.length - 1].consoleTime;

    // Night before sunrise
    const sunriseTs = `${date}T${sunrise.padStart(5, '0')}:00+08:00`;
    if (firstTs < sunriseTs) {
      areas.push({ x1: firstTs, x2: sunriseTs });
    }
    // Night after sunset
    const sunsetTs = `${date}T${sunset.padStart(5, '0')}:00+08:00`;
    if (lastTs > sunsetTs && toMin(lastTs.slice(11, 16)) > setMin) {
      areas.push({ x1: sunsetTs, x2: lastTs });
    }
    void riseMin;
    void setMin;
  }
  return areas;
}

function toMin(t: string): number {
  const parts = t.split(':').map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

export default function WeatherChart({ data, hours, onHoursChange, sunrise, sunset }: Props) {
  const t = useTranslations('weather');

  const chartData = data.map(r => ({
    time: r.consoleTime,
    outTemp: r.outsideTempC,
    inTemp: r.insideTempC,
    outHumid: r.outsideHumidityPercent,
    baro: r.barometerHpa,
    wind: r.windSpeedMs,
    rain: r.dailyRainMm,
  }));

  const nightAreas = buildNightAreas(data, sunrise, sunset);

  return (
    <div className="card p-5" style={{ borderColor: 'var(--line)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="label">{t('dataTrends')}</p>
        <div className="flex gap-1 flex-wrap">
          {HOURS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onHoursChange(opt.value)}
              className="px-3 py-1 text-xs rounded transition-colors"
              style={{
                background: hours === opt.value ? 'var(--ink)' : 'var(--bg-muted)',
                color: hours === opt.value ? 'var(--bg)' : 'var(--ink-secondary)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-xs" style={{ color: 'var(--ink-muted)' }}>
          No data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            {/* Night shading */}
            {nightAreas.map((a, i) => (
              <ReferenceArea key={i} x1={a.x1} x2={a.x2} fill="var(--bg-muted)" fillOpacity={0.5} />
            ))}

            <XAxis
              dataKey="time"
              tickFormatter={(v) => formatTime(v as string, hours)}
              tick={{ fontSize: 10, fill: 'var(--ink-faint)' }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />

            {/* Temperature axis (left) */}
            <YAxis
              yAxisId="temp"
              orientation="left"
              tick={{ fontSize: 10, fill: 'var(--ink-faint)' }}
              tickLine={false}
              axisLine={false}
              unit="°"
              width={36}
            />
            {/* Humidity axis (right) */}
            <YAxis
              yAxisId="humid"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--ink-faint)' }}
              tickLine={false}
              axisLine={false}
              unit="%"
              width={36}
            />
            {/* Pressure axis (hidden, same right side) */}
            <YAxis yAxisId="baro" hide />
            {/* Wind axis (hidden) */}
            <YAxis yAxisId="wind" hide />

            <Tooltip
              contentStyle={{
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: 0,
                fontSize: 11,
              }}
              labelFormatter={(v) => formatTime(v as string, hours)}
              formatter={(value, name) => {
                if (value == null) return ['—', name];
                const n = Number(value);
                const labels: Record<string, [string, string]> = {
                  outTemp: [n.toFixed(1), '°C Out'],
                  inTemp: [n.toFixed(1), '°C In'],
                  outHumid: [n.toFixed(0), '% Humidity'],
                  baro: [n.toFixed(1), 'hPa'],
                  wind: [n.toFixed(1), 'm/s Wind'],
                  rain: [n.toFixed(1), 'mm Rain'],
                };
                return labels[name as string] ?? [n.toFixed(1), name];
              }}
            />
            <Legend
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: 'var(--ink-secondary)' }}
            />

            <Line yAxisId="temp" type="monotone" dataKey="outTemp" name="outTemp" stroke="#3b82f6" dot={false} strokeWidth={1.5} connectNulls />
            <Line yAxisId="temp" type="monotone" dataKey="inTemp" name="inTemp" stroke="#93c5fd" dot={false} strokeWidth={1} strokeDasharray="3 2" connectNulls />
            <Line yAxisId="humid" type="monotone" dataKey="outHumid" name="outHumid" stroke="#10b981" dot={false} strokeWidth={1.5} connectNulls />
            <Line yAxisId="baro" type="monotone" dataKey="baro" name="baro" stroke="#8b5cf6" dot={false} strokeWidth={1.5} connectNulls />
            <Bar yAxisId="wind" dataKey="wind" name="wind" fill="#f59e0b" opacity={0.6} />
            <Line yAxisId="wind" type="monotone" dataKey="rain" name="rain" stroke="#06b6d4" dot={false} strokeWidth={1.5} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
