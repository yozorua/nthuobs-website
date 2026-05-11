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
  { key: 'outHumid', label: 'Out Humid', color: '#34d399', yAxisId: 'humid', unit: '%'   },
  { key: 'inHumid',  label: 'In Humid',  color: '#6ee7b7', yAxisId: 'humid', unit: '%', dashed: true },
  { key: 'baro',     label: 'Pressure',  color: '#c084fc', yAxisId: 'baro',  unit: 'hPa' },
  { key: 'wind',     label: 'Wind',      color: '#fbbf24', yAxisId: 'wind',  unit: 'm/s' },
  { key: 'rain',     label: 'Rain',      color: '#38bdf8', yAxisId: 'rain',  unit: 'mm'  },
  { key: 'sqm',      label: 'SQM',       color: '#a78bfa', yAxisId: 'sqm',   unit: 'mag' },
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

  const [riseH = 6, riseM = 0] = sunrise.split(':').map(Number);
  const [setH  = 18, setM  = 0] = sunset.split(':').map(Number);
  const riseOffsetMs = (riseH * 60 + riseM) * 60_000;
  const setOffsetMs  = (setH  * 60 + setM)  * 60_000;

  const localDates = [...new Set(data.map(r => localDateStr(r.scriptTimestamp)))];
  const zones: Array<{ x1: string; x2: string; isDay: boolean }> = [];

  for (const dateStr of localDates) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const midnightUtcMs = Date.UTC(y!, mo! - 1, d!) - TZ_OFFSET_MS;
    const sunriseUtcMs  = midnightUtcMs + riseOffsetMs;
    const sunsetUtcMs   = midnightUtcMs + setOffsetMs;

    // Only rows for this local date, in order
    const dayRows = data
      .filter(r => localDateStr(r.scriptTimestamp) === dateStr)
      .sort((a, b) => a.scriptTimestamp < b.scriptTimestamp ? -1 : 1);
    if (dayRows.length < 2) continue;

    // Partition into three bands using actual data timestamps as boundaries
    // so recharts can always locate them in the categorical X scale.
    const preRise  = dayRows.filter(r => new Date(r.scriptTimestamp).getTime() <  sunriseUtcMs);
    const dayBand  = dayRows.filter(r => {
      const t = new Date(r.scriptTimestamp).getTime();
      return t >= sunriseUtcMs && t <= sunsetUtcMs;
    });
    const postSet  = dayRows.filter(r => new Date(r.scriptTimestamp).getTime() >  sunsetUtcMs);

    if (preRise.length >= 2)
      zones.push({ x1: preRise[0].scriptTimestamp,  x2: preRise[preRise.length - 1].scriptTimestamp,  isDay: false });
    if (dayBand.length >= 2)
      zones.push({ x1: dayBand[0].scriptTimestamp,  x2: dayBand[dayBand.length - 1].scriptTimestamp,  isDay: true  });
    if (postSet.length >= 2)
      zones.push({ x1: postSet[0].scriptTimestamp,  x2: postSet[postSet.length - 1].scriptTimestamp,  isDay: false });
  }

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

  return (
    <g>
      {zones.map((z, i) => {
        const px1 = xScale(z.x1, { position: 'start' });
        const px2 = xScale(z.x2, { position: 'end'   });
        if (px1 == null || px2 == null || px2 <= px1) return null;
        return (
          <rect
            key={i}
            x={px1}
            y={offset.top}
            width={px2 - px1}
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
export default function WeatherChart({ data, hours, onHoursChange, sunrise, sunset, loading }: Props) {
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

  const chartData = data.map((r, i) => {
    const prevRain = i > 0 ? data[i - 1].dailyRainMm : null;
    const curRain  = r.dailyRainMm;
    let rainDelta: number | null = null;
    if (curRain != null) {
      if (prevRain != null) {
        const delta = curRain - prevRain;
        // Negative delta means the daily counter reset; treat it as rain since the reset
        rainDelta = delta < 0 ? Math.max(0, curRain) : delta;
      } else {
        rainDelta = 0;
      }
    }
    return {
      time:     r.scriptTimestamp,
      outTemp:  r.outsideTempC,
      inTemp:   r.insideTempC,
      outHumid: r.outsideHumidityPercent,
      inHumid:  r.insideHumidityPercent,
      baro:     r.barometerHpa,
      wind:     r.windSpeedMs,
      rain:     rainDelta,
      sqm:      r.sqmMagPerArcsec2,
    };
  });

  const dayNightZones = buildDayNightZones(data, sunrise, sunset);
  const showTempAxis  = activeSeries.has('outTemp') || activeSeries.has('inTemp');
  const showHumidAxis = activeSeries.has('outHumid') || activeSeries.has('inHumid');

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
              {s.label}
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
            <ComposedChart data={chartData} margin={{ top: 4, right: showHumidAxis ? 38 : 12, bottom: 0, left: 0 }}>

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

              {/* Pressure — tight domain, hidden axis */}
              <YAxis yAxisId="baro" hide domain={baroDomain} />
              {/* Wind & rain — start from 0 */}
              <YAxis yAxisId="wind" hide domain={[0, 'dataMax + 1']} />
              <YAxis yAxisId="rain" hide domain={[0, 'dataMax + 1']} />
              {/* SQM — higher mag = darker sky, so invert axis */}
              <YAxis yAxisId="sqm" hide domain={['dataMin - 0.5', 'dataMax + 0.5']} reversed />

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
                  fill="#fbbf24" fillOpacity={0.65} maxBarSize={4} />
              )}
              {activeSeries.has('rain') && (
                <Bar yAxisId="rain" dataKey="rain" name="rain"
                  fill="#38bdf8" fillOpacity={0.72} maxBarSize={6} />
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
