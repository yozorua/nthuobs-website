'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ComposedChart, Line, Bar, XAxis, YAxis,
  ResponsiveContainer, CartesianGrid, Tooltip,
  useXAxisScale, usePlotArea, useOffset,
} from 'recharts';
import { ChartRow } from './types';

const HOURS_OPTIONS = [
  { label: '3h',  value: 3   },
  { label: '12h', value: 12  },
  { label: '24h', value: 24  },
  { label: '3d',  value: 72  },
  { label: '7d',  value: 168 },
];

interface SeriesOption {
  key: string;
  labelKey: string;
  color: string;
  yAxisId: string;
  unit: string;
  dashed?: boolean;
}

const SERIES_OPTIONS: SeriesOption[] = [
  { key: 'outTemp',  labelKey: 'seriesOutTemp',  color: '#60a5fa', yAxisId: 'temp',  unit: '°C' },
  { key: 'inTemp',   labelKey: 'seriesInTemp',   color: '#93c5fd', yAxisId: 'temp',  unit: '°C', dashed: true },
  { key: 'outHumid', labelKey: 'seriesOutHumid', color: '#34d399', yAxisId: 'humid', unit: '%'   },
  { key: 'inHumid',  labelKey: 'seriesInHumid',  color: '#6ee7b7', yAxisId: 'humid', unit: '%', dashed: true },
  { key: 'baro',     labelKey: 'seriesBaro',     color: '#c084fc', yAxisId: 'baro',  unit: 'hPa' },
  { key: 'wind',     labelKey: 'seriesWind',     color: '#fbbf24', yAxisId: 'wind',  unit: 'm/s' },
  { key: 'rain',     labelKey: 'seriesRain',     color: '#38bdf8', yAxisId: 'rain',  unit: 'mm'  },
  { key: 'sqm',      labelKey: 'seriesSqm',      color: '#a78bfa', yAxisId: 'sqm',   unit: 'mag' },
];

const DEFAULT_SERIES = new Set(['outTemp', 'outHumid']);

interface Props {
  data: ChartRow[];
  hours: number;
  onHoursChange: (h: number) => void;
  sunrise?: string | null;
  sunset?: string | null;
  loading?: boolean;
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

// Build day / night ReferenceArea spans using actual data timestamps as
// boundaries (recharts categorical X axis requires exact data-value matches).
// scriptTimestamp values are UTC ISO strings; sunrise/sunset are local +08:00
// clock strings ("HH:MM").
const TZ_OFFSET_MS = 8 * 3_600_000; // UTC+8

function localDateStr(utcIso: string): string {
  const localMs = new Date(utcIso).getTime() + TZ_OFFSET_MS;
  const d = new Date(localMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function buildDayNightZones(
  data: ChartRow[],
  sunrise?: string | null,
  sunset?: string | null,
): Array<{ x1: string; x2: string; isDay: boolean }> {
  if (!sunrise || !sunset || data.length === 0) return [];

  const sorted = [...data].sort((a, b) =>
    a.scriptTimestamp < b.scriptTimestamp ? -1 : 1);

  const [riseH = 6, riseM = 0] = sunrise.split(':').map(Number);
  const [setH  = 18, setM  = 0] = sunset.split(':').map(Number);
  const riseOffsetMs = (riseH * 60 + riseM) * 60_000;
  const setOffsetMs  = (setH  * 60 + setM)  * 60_000;

  // One sunrise + one sunset transition per local date in the data
  const localDates = [...new Set(sorted.map(r => localDateStr(r.scriptTimestamp)))];
  const transitions: Array<{ ms: number; isDay: boolean }> = [];
  for (const dateStr of localDates) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const midnightUtcMs = Date.UTC(y!, mo! - 1, d!) - TZ_OFFSET_MS;
    transitions.push({ ms: midnightUtcMs + riseOffsetMs, isDay: true  });
    transitions.push({ ms: midnightUtcMs + setOffsetMs,  isDay: false });
  }
  transitions.sort((a, b) => a.ms - b.ms);

  // Determine day/night at the first data point
  const firstMs = new Date(sorted[0].scriptTimestamp).getTime();
  let isDay = false;
  for (const t of transitions) {
    if (t.ms <= firstMs) isDay = t.isDay;
    else break;
  }

  // Walk data in order; split a zone whenever a transition falls between two
  // consecutive points — no per-date partitioning, so midnight is seamless.
  const zones: Array<{ x1: string; x2: string; isDay: boolean }> = [];
  let zoneStart = 0;
  let tIdx = transitions.findIndex(t => t.ms > firstMs);
  if (tIdx === -1) tIdx = transitions.length;

  for (let i = 1; i < sorted.length; i++) {
    const prevMs = new Date(sorted[i - 1].scriptTimestamp).getTime();
    const currMs = new Date(sorted[i].scriptTimestamp).getTime();

    while (tIdx < transitions.length &&
           transitions[tIdx].ms > prevMs &&
           transitions[tIdx].ms <= currMs) {
      zones.push({ x1: sorted[zoneStart].scriptTimestamp, x2: sorted[i - 1].scriptTimestamp, isDay });
      zoneStart = i;
      isDay = transitions[tIdx].isDay;
      tIdx++;
    }
  }

  // Close the final zone
  zones.push({ x1: sorted[zoneStart].scriptTimestamp, x2: sorted[sorted.length - 1].scriptTimestamp, isDay });

  return zones;
}

// ── Day/night background — rendered as a direct recharts 3.x child ───────────
// Uses useXAxisScale / usePlotArea hooks so it bypasses ReferenceArea's
// categorical-domain lookup, which silently discards areas in recharts 3.x.
function DayNightBackground({ zones }: {
  zones: Array<{ x1: string; x2: string; isDay: boolean }>;
}) {
  const xScale  = useXAxisScale();
  const plotArea = usePlotArea();
  const offset   = useOffset();

  if (!xScale || !plotArea || !offset) return null;

  // Band scale: xScale(v) returns the LEFT edge of v's band.
  // Add bandwidth() so each zone covers through the RIGHT edge of its last band.
  const bw: number =
    typeof (xScale as unknown as { bandwidth?: () => number }).bandwidth === 'function'
      ? (xScale as unknown as { bandwidth: () => number }).bandwidth()
      : 0;

  return (
    <g>
      {zones.map((z, i) => {
        const px1 = xScale(z.x1);
        if (px1 == null) return null;

        // Use the next zone's left edge as this zone's right edge so adjacent
        // zones never overlap. Only the last zone needs to extend by bw to
        // cover the final band.
        let right: number;
        if (i + 1 < zones.length) {
          const nextPx = xScale(zones[i + 1].x1);
          if (nextPx == null) return null;
          right = nextPx;
        } else {
          const px2 = xScale(z.x2);
          if (px2 == null) return null;
          right = px2 + bw;
        }

        return (
          <rect
            key={i}
            x={px1}
            y={offset.top}
            width={right - px1}
            height={plotArea.height}
            fill={z.isDay ? 'rgba(255,230,160,0.04)' : 'rgba(20,40,100,0.12)'}
          />
        );
      })}
    </g>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
  label?: string;
  hours: number;
  labelMap: Record<string, string>;
}

function ChartTooltip({ active, payload, label, hours, labelMap }: TooltipProps) {
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
              {labelMap[p.name] ?? p.name}
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
export default function WeatherChart({ data, hours, onHoursChange, sunrise, sunset, loading }: Props) {
  const t = useTranslations('weather');
  const labelMap = Object.fromEntries(SERIES_OPTIONS.map(s => [s.key, t(s.labelKey as Parameters<typeof t>[0])]));
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
    inHumid:  r.insideHumidityPercent,
    baro:     r.barometerHpa,
    wind:     r.windSpeedMs,
    rain:     r.rainTotalMm,
    sqm:      r.sqmMagPerArcsec2,
  }));

  const dayNightZones = buildDayNightZones(data, sunrise, sunset);
  const showTempAxis  = activeSeries.has('outTemp') || activeSeries.has('inTemp');
  const showHumidAxis = activeSeries.has('outHumid') || activeSeries.has('inHumid');
  const showBaroAxis  = activeSeries.has('baro') && !showTempAxis;
  const showWindAxis  = activeSeries.has('wind') && !showTempAxis && !showBaroAxis;
  const showSqmAxis   = activeSeries.has('sqm') && !showTempAxis && !showBaroAxis && !showWindAxis;
  const showRainAxis  = activeSeries.has('rain') && !showHumidAxis;

  // Tight domain helpers — pad a bit above/below actual data range
  const tempDomain  = [
    (d: number) => Math.floor(d - 2),
    (d: number) => Math.ceil(d + 2),
  ] as [((v: number) => number), ((v: number) => number)];

  const humidDomain = [
    (d: number) => Math.max(0, Math.floor(d - 5)),
    (d: number) => Math.min(100, Math.ceil(d + 5)),
  ] as [((v: number) => number), ((v: number) => number)];

  const baroDomain = [
    (d: number) => Math.floor(d - 2),
    (d: number) => Math.ceil(d + 2),
  ] as [((v: number) => number), ((v: number) => number)];

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
              {labelMap[s.key]}
            </button>
          );
        })}
      </div>

      {/* ── Chart ── */}
      <div className="relative">
        {/* Loading overlay */}
        {loading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
            style={{ background: 'rgba(0,0,0,0.20)', backdropFilter: 'blur(3px)' }}
          >
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{
                    background: 'rgba(255,255,255,0.55)',
                    animationDelay: `${i * 0.18}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {chartData.length === 0 && !loading ? (
          <div className="h-64 flex items-center justify-center text-xs"
               style={{ color: 'var(--ink-muted)' }}>
            No data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 4, right: (showHumidAxis || showRainAxis) ? 38 : 12, bottom: 0, left: (showTempAxis || showBaroAxis || showWindAxis || showSqmAxis) ? 4 : 0 }} barCategoryGap="2%">

              {/* Day / night background zones */}
              <DayNightBackground zones={dayNightZones} />

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

              {/* Temperature axis — left */}
              <YAxis
                yAxisId="temp"
                orientation="left"
                hide={!showTempAxis}
                domain={tempDomain}
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
                tickLine={false}
                axisLine={false}
                unit="°"
                width={showTempAxis ? 34 : 0}
              />

              {/* Humidity axis — right, tight range */}
              <YAxis
                yAxisId="humid"
                orientation="right"
                domain={humidDomain}
                hide={!showHumidAxis}
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
                tickLine={false}
                axisLine={false}
                unit="%"
                width={showHumidAxis ? 34 : 0}
              />

              {/* Pressure */}
              <YAxis yAxisId="baro" orientation="left"
                hide={!showBaroAxis} width={showBaroAxis ? 46 : 0}
                domain={baroDomain}
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
                tickLine={false} axisLine={false} unit=" hPa" />
              {/* Wind */}
              <YAxis yAxisId="wind" orientation="left"
                hide={!showWindAxis} width={showWindAxis ? 36 : 0}
                domain={[0, 'dataMax + 1']}
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
                tickLine={false} axisLine={false} unit=" m/s" />
              {/* Rain — right side */}
              <YAxis yAxisId="rain" orientation="right"
                hide={!showRainAxis} width={showRainAxis ? 36 : 0}
                domain={[0, 'dataMax + 1']}
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
                tickLine={false} axisLine={false} unit=" mm" />
              {/* SQM — left, higher mag = darker sky, so invert */}
              <YAxis yAxisId="sqm" orientation="left"
                hide={!showSqmAxis} width={showSqmAxis ? 40 : 0}
                domain={['dataMin - 0.5', 'dataMax + 0.5']} reversed
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
                tickLine={false} axisLine={false} />

              <Tooltip
                content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    payload={props.payload as unknown as TooltipProps['payload']}
                    label={props.label as string}
                    hours={hours}
                    labelMap={labelMap}
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
              {activeSeries.has('inHumid') && (
                <Line yAxisId="humid" type="monotone" dataKey="inHumid" name="inHumid"
                  stroke="#6ee7b7" dot={false} strokeWidth={1.2}
                  strokeDasharray="4 3" connectNulls />
              )}
              {activeSeries.has('baro') && (
                <Line yAxisId="baro" type="monotone" dataKey="baro" name="baro"
                  stroke="#c084fc" dot={false} strokeWidth={1.5} connectNulls />
              )}
              {activeSeries.has('wind') && (
                <Bar yAxisId="wind" dataKey="wind" name="wind"
                  fill="#fbbf24" fillOpacity={0.65} maxBarSize={8} />
              )}
              {activeSeries.has('rain') && (
                <Bar yAxisId="rain" dataKey="rain" name="rain"
                  fill="#38bdf8" fillOpacity={0.72} maxBarSize={10} />
              )}
              {activeSeries.has('sqm') && (
                <Line yAxisId="sqm" type="monotone" dataKey="sqm" name="sqm"
                  stroke="#a78bfa" dot={false} strokeWidth={1.5} connectNulls />
              )}

            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
