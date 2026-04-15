'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ComposedChart, Line, XAxis, YAxis,
  ResponsiveContainer, ReferenceArea, CartesianGrid, Tooltip,
} from 'recharts';
import { ChartRow } from './types';

const HOURS_OPTIONS = [
  { label: '1h',  value: 1   },
  { label: '12h', value: 12  },
  { label: '24h', value: 24  },
  { label: '3d',  value: 72  },
  { label: '7d',  value: 168 },
];

interface SeriesOption {
  key: string;
  label: string;
  color: string;
  yAxisId: string;
  unit: string;
  dashed?: boolean;
}

const SERIES_OPTIONS: SeriesOption[] = [
  { key: 'outTemp',  label: 'Out Temp',  color: '#60a5fa', yAxisId: 'temp',  unit: '°C' },
  { key: 'inTemp',   label: 'In Temp',   color: '#93c5fd', yAxisId: 'temp',  unit: '°C', dashed: true },
  { key: 'outHumid', label: 'Humidity',  color: '#34d399', yAxisId: 'humid', unit: '%'   },
  { key: 'baro',     label: 'Pressure',  color: '#c084fc', yAxisId: 'baro',  unit: 'hPa' },
  { key: 'wind',     label: 'Wind',      color: '#fbbf24', yAxisId: 'wind',  unit: 'm/s' },
  { key: 'rain',     label: 'Rain',      color: '#38bdf8', yAxisId: 'rain',  unit: 'mm'  },
];

const DEFAULT_SERIES = new Set(['outTemp', 'outHumid']);

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
  return d.toLocaleDateString('en-GB', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function toMin(t: string): number {
  const parts = t.split(':').map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function buildNightAreas(data: ChartRow[], sunrise?: string | null, sunset?: string | null) {
  if (!sunrise || !sunset || data.length === 0) return [];

  const riseMin = toMin(sunrise);
  const setMin  = toMin(sunset);
  const areas: Array<{ x1: string; x2: string }> = [];

  const dates = [...new Set(data.map(r => r.scriptTimestamp.slice(0, 10)))];
  for (const date of dates) {
    const dayRows = data.filter(r => r.scriptTimestamp.startsWith(date));
    if (!dayRows.length) continue;
    const firstTs = dayRows[0].scriptTimestamp;
    const lastTs  = dayRows[dayRows.length - 1].scriptTimestamp;

    const sunriseTs = `${date}T${sunrise.padStart(5, '0')}:00+08:00`;
    if (firstTs < sunriseTs) areas.push({ x1: firstTs, x2: sunriseTs });

    const sunsetTs = `${date}T${sunset.padStart(5, '0')}:00+08:00`;
    if (lastTs > sunsetTs && toMin(lastTs.slice(11, 16)) > setMin) {
      areas.push({ x1: sunsetTs, x2: lastTs });
    }
    void riseMin; void setMin;
  }
  return areas;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
  label?: string;
  hours: number;
}

function ChartTooltip({ active, payload, label, hours }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const visible = payload.filter(p => p.value != null);
  if (!visible.length) return null;

  return (
    <div style={{
      background: 'rgba(10,12,22,0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10,
      padding: '8px 12px',
      fontSize: 11,
      minWidth: 130,
    }}>
      <div style={{
        color: 'rgba(255,255,255,0.4)',
        marginBottom: 6,
        fontSize: 10,
        letterSpacing: '0.06em',
      }}>
        {formatTime(label, hours)}
      </div>
      {visible.map(p => {
        const s = SERIES_OPTIONS.find(o => o.key === p.name);
        const n = Number(p.value);
        const val = s?.unit === '°C'  ? n.toFixed(1) :
                    s?.unit === '%'   ? n.toFixed(0) :
                    s?.unit === 'hPa' ? n.toFixed(1) :
                                        n.toFixed(1);
        return (
          <div key={p.name} style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 14,
            lineHeight: 1.7,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>
              {s?.label ?? p.name}
            </span>
            <span style={{ color: p.color, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
              {val} {s?.unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function WeatherChart({ data, hours, onHoursChange, sunrise, sunset }: Props) {
  const t = useTranslations('weather');
  const [activeSeries, setActiveSeries] = useState<Set<string>>(DEFAULT_SERIES);

  const toggleSeries = (key: string) => {
    setActiveSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // keep at least one
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const chartData = data.map(r => ({
    time:     r.scriptTimestamp,
    outTemp:  r.outsideTempC,
    inTemp:   r.insideTempC,
    outHumid: r.outsideHumidityPercent,
    baro:     r.barometerHpa,
    wind:     r.windSpeedMs,
    rain:     r.dailyRainMm,
  }));

  const nightAreas  = buildNightAreas(data, sunrise, sunset);
  const showTempAxis  = activeSeries.has('outTemp') || activeSeries.has('inTemp');
  const showHumidAxis = activeSeries.has('outHumid');

  return (
    <div className="card p-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <p className="label">{t('dataTrends')}</p>
        <div className="flex gap-1 flex-wrap">
          {HOURS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onHoursChange(opt.value)}
              className="px-3 py-1 text-xs transition-all"
              style={{
                borderRadius: 6,
                background: hours === opt.value
                  ? 'rgba(255,255,255,0.82)'
                  : 'rgba(255,255,255,0.07)',
                color: hours === opt.value
                  ? 'rgba(0,0,0,0.72)'
                  : 'rgba(255,255,255,0.50)',
                border: '1px solid transparent',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Series toggle chips ── */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {SERIES_OPTIONS.map(s => {
          const active = activeSeries.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              style={{
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 20,
                border: `1px solid ${active ? s.color + 'aa' : 'rgba(255,255,255,0.14)'}`,
                background: active ? s.color + '22' : 'transparent',
                color: active ? s.color : 'rgba(255,255,255,0.30)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                letterSpacing: '0.04em',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── Chart ── */}
      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-xs"
             style={{ color: 'var(--ink-muted)' }}>
          No data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 4, right: showHumidAxis ? 38 : 12, bottom: 0, left: 0 }}>

            {/* Night shading */}
            {nightAreas.map((a, i) => (
              <ReferenceArea key={i} x1={a.x1} x2={a.x2}
                fill="rgba(0,0,0,0.22)" fillOpacity={1} />
            ))}

            <CartesianGrid
              strokeDasharray="1 6"
              stroke="rgba(255,255,255,0.07)"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              tickFormatter={(v) => formatTime(v as string, hours)}
              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
              tickLine={false}
              axisLine={false}
              minTickGap={52}
            />

            {/* Temperature axis — left, only when a temp series is active */}
            <YAxis
              yAxisId="temp"
              orientation="left"
              hide={!showTempAxis}
              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
              tickLine={false}
              axisLine={false}
              unit="°"
              width={showTempAxis ? 34 : 0}
            />

            {/* Humidity axis — right, only when humidity series is active */}
            <YAxis
              yAxisId="humid"
              orientation="right"
              domain={[0, 100]}
              hide={!showHumidAxis}
              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
              tickLine={false}
              axisLine={false}
              unit="%"
              width={showHumidAxis ? 34 : 0}
            />

            {/* Other axes — always hidden, used only for internal scale */}
            <YAxis yAxisId="baro" hide />
            <YAxis yAxisId="wind" hide />
            <YAxis yAxisId="rain" hide />

            <Tooltip
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  payload={props.payload as unknown as TooltipProps['payload']}
                  label={props.label as string}
                  hours={hours}
                />
              )}
              cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }}
            />

            {activeSeries.has('outTemp') && (
              <Line yAxisId="temp" type="monotone" dataKey="outTemp" name="outTemp"
                stroke="#60a5fa" dot={false} strokeWidth={1.8} connectNulls />
            )}
            {activeSeries.has('inTemp') && (
              <Line yAxisId="temp" type="monotone" dataKey="inTemp" name="inTemp"
                stroke="#93c5fd" dot={false} strokeWidth={1.2}
                strokeDasharray="4 3" connectNulls />
            )}
            {activeSeries.has('outHumid') && (
              <Line yAxisId="humid" type="monotone" dataKey="outHumid" name="outHumid"
                stroke="#34d399" dot={false} strokeWidth={1.8} connectNulls />
            )}
            {activeSeries.has('baro') && (
              <Line yAxisId="baro" type="monotone" dataKey="baro" name="baro"
                stroke="#c084fc" dot={false} strokeWidth={1.5} connectNulls />
            )}
            {activeSeries.has('wind') && (
              <Line yAxisId="wind" type="monotone" dataKey="wind" name="wind"
                stroke="#fbbf24" dot={false} strokeWidth={1.5} connectNulls />
            )}
            {activeSeries.has('rain') && (
              <Line yAxisId="rain" type="monotone" dataKey="rain" name="rain"
                stroke="#38bdf8" dot={false} strokeWidth={1.5} connectNulls />
            )}

          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
