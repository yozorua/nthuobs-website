'use client';

import { WeatherReading } from './types';

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt(v: number | null, d = 1): string {
  return v != null ? v.toFixed(d) : '—';
}

function beaufort(ms: number | null): number {
  if (ms == null) return 0;
  if (ms < 0.3) return 0; if (ms < 1.6) return 1; if (ms < 3.4) return 2;
  if (ms < 5.5) return 3; if (ms < 8.0) return 4; if (ms < 10.8) return 5;
  if (ms < 13.9) return 6; if (ms < 17.2) return 7; if (ms < 20.8) return 8;
  if (ms < 24.5) return 9; if (ms < 28.5) return 10; if (ms < 32.7) return 11;
  return 12;
}

function windDir(text: string | null | undefined, deg: number | null | undefined): string {
  if (text) return text;
  if (deg == null) return '—';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ── Condition icons — 48×48 viewBox, white stroke, no fill ──────────────────
// Each icon avoids ugly overlapping shapes: PartlyCloudy places sun and cloud
// in separate regions; Cloudy draws a single clean cloud.
function ConditionIcon({ cond, size = 64 }: { cond: string; size?: number }) {
  const v = 48; // internal viewBox size
  const st = {
    stroke: 'rgba(255,255,255,0.88)',
    strokeWidth: 2.2,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const faint = { ...st, stroke: 'rgba(255,255,255,0.45)' };

  // Sun centred at (cx,cy) with given radius and ray length
  const Sun = ({ cx, cy, r, rl = 4, rays = 8, opacity = 1 }: {
    cx: number; cy: number; r: number; rl?: number; rays?: number; opacity?: number;
  }) => (
    <g opacity={opacity}>
      <circle cx={cx} cy={cy} r={r} {...st} />
      {Array.from({ length: rays }).map((_, i) => {
        const a = (i * 360 / rays - 90) * Math.PI / 180;
        const r1 = r + 3, r2 = r + 3 + rl;
        return <line key={i}
          x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)}
          x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)}
          {...st} opacity={opacity} />;
      })}
    </g>
  );

  // Cloud shape: smooth bezier, top-bumps then flat bottom
  // Positions: left edge ~xl, right edge ~xr, top ~yt, bottom ~yb
  const Cloud = ({ xl = 4, xr = 44, yt = 16, yb = 36, style = st }: {
    xl?: number; xr?: number; yt?: number; yb?: number;
    style?: typeof st;
  }) => {
    const w = xr - xl, h = yb - yt;
    // Control points are fractions of width/height
    const d = [
      `M ${xl} ${yb}`,
      // left wall
      `Q ${xl} ${yt + h * 0.5} ${xl + w * 0.15} ${yt + h * 0.35}`,
      // left bump
      `Q ${xl + w * 0.18} ${yt} ${xl + w * 0.38} ${yt + h * 0.1}`,
      // centre-top saddle
      `Q ${xl + w * 0.45} ${yt - h * 0.18} ${xl + w * 0.62} ${yt + h * 0.05}`,
      // right bump
      `Q ${xl + w * 0.75} ${yt - h * 0.1} ${xl + w * 0.85} ${yt + h * 0.25}`,
      // right wall
      `Q ${xr} ${yt + h * 0.35} ${xr} ${yt + h * 0.6}`,
      `Q ${xr} ${yb} ${xr - w * 0.1} ${yb}`,
      // flat bottom back to start
      `L ${xl} ${yb} Z`,
    ].join(' ');
    return <path d={d} {...style} />;
  };

  // Rain drops: 4 short diagonal lines below a cloud
  const Drops = ({ baseY, xl = 10, xr = 38 }: { baseY: number; xl?: number; xr?: number }) => {
    const xs = [xl, xl + (xr - xl) / 3, xl + (xr - xl) * 2 / 3, xr];
    return <>{xs.map((x, i) => (
      <line key={i} x1={x} y1={baseY} x2={x - 3} y2={baseY + 7} {...st} />
    ))}</>;
  };

  let icon: React.ReactNode;

  switch (cond) {
    case 'Clear':
      icon = <Sun cx={24} cy={24} r={9} rl={5} rays={8} />;
      break;

    case 'PartlyCloudy':
      // Sun sits in the upper-right; cloud is in the lower-left — no overlap
      icon = (
        <>
          <Sun cx={34} cy={13} r={7} rl={4} rays={6} opacity={0.80} />
          {/* Cloud sits lower, well below the sun */}
          <Cloud xl={2} xr={40} yt={24} yb={42} />
        </>
      );
      break;

    case 'Cloudy':
      // Single prominent cloud, vertically centred
      icon = <Cloud xl={2} xr={46} yt={12} yb={36} />;
      break;

    case 'Rainy':
      icon = (
        <>
          <Cloud xl={3} xr={45} yt={8} yb={28} />
          <Drops baseY={32} xl={10} xr={38} />
        </>
      );
      break;

    case 'Windy':
      // Three smooth arcs suggesting flowing wind
      icon = (
        <>
          <path d="M 4 14 Q 16 10 28 14 Q 36 18 34 22 Q 32 26 24 22" {...st} />
          <path d="M 4 24 Q 14 20 26 24 Q 36 28 34 32 Q 32 36 22 32" {...st} />
          <path d="M 8 34 Q 20 30 32 34 Q 40 38 38 42" {...st} />
        </>
      );
      break;

    default:
      // Three dots — "Unknown"
      icon = <>{[14, 24, 34].map(x => (
        <circle key={x} cx={x} cy={24} r={2.5} fill="rgba(255,255,255,0.55)" stroke="none" />
      ))}</>;
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${v} ${v}`} style={{ flexShrink: 0 }}>
      {icon}
    </svg>
  );
}

// ── Metric cell ──────────────────────────────────────────────────────────────
function MetricCell({ label, value, unit, sub }: {
  label: string; value: string; unit: string; sub?: string;
}) {
  return (
    <div className="flex-1 min-w-[90px] px-4 py-3"
         style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="text-[10px] uppercase tracking-widest mb-1.5"
           style={{ color: 'var(--ink-faint)' }}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-light"
              style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {unit && <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{unit}</span>}
      </div>
      {sub && <div className="text-[10px] mt-1 leading-tight"
                   style={{ color: 'var(--ink-faint)' }}>{sub}</div>}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
  reading: WeatherReading | null;
  lastUpdate: string;
  condition: string;    // translated label
  conditionKey: string; // 'Clear' | 'Cloudy' | …
}

export default function InstrumentPanel({ reading, lastUpdate, condition, conditionKey }: Props) {
  const r = reading;
  const bf  = beaufort(r?.windSpeedMs ?? null);
  const dir = windDir(r?.windDirectionText, r?.windDirectionDeg);

  // Wind sub: direction · Beaufort · gust if available
  const windSub = [
    dir,
    `Bf ${bf}`,
    r?.windGustMs != null ? `G ${r.windGustMs.toFixed(1)}` : null,
  ].filter(Boolean).join('  ');

  return (
    <div style={{
      borderRadius: 'var(--card-radius, 0px)',
      border: '1px solid var(--card-border)',
      borderTop: '2px solid rgba(255,255,255,0.35)',
      background: 'var(--card-bg)',
      backdropFilter: 'var(--card-glass)',
      WebkitBackdropFilter: 'var(--card-glass)',
      boxShadow: 'var(--card-shadow, none)',
      overflow: 'hidden',
    }}>
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 py-1.5"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.06)' }}>
        <span className="text-[10px]" style={{ color: 'var(--ink-faint)', letterSpacing: '0.05em' }}>
          24°47′N  120°59′E  EL 55 m
        </span>
        <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
          UPDATED  {lastUpdate}
        </span>
      </div>

      {/* Hero: icon + condition + big outdoor temp */}
      <div className="flex items-center gap-5 px-6 py-5">
        <ConditionIcon cond={conditionKey} size={68} />
        <div className="flex-1">
          <div className="text-sm font-light tracking-[0.18em] uppercase mb-1"
               style={{ color: 'var(--ink-muted)' }}>
            {condition}
          </div>
          <div className="flex items-start gap-1 leading-none">
            <span className="text-6xl font-extralight"
                  style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {r?.outsideTempC != null ? r.outsideTempC.toFixed(1) : '—'}
            </span>
            <span className="text-2xl mt-1" style={{ color: 'var(--ink-muted)' }}>°C</span>
          </div>
          {r?.outTempDayHighC != null && (
            <div className="text-xs mt-1.5" style={{ color: 'var(--ink-faint)' }}>
              H {fmt(r.outTempDayHighC)}°  ·  L {fmt(r.outTempDayLowC ?? null)}°
            </div>
          )}
        </div>
      </div>

      {/* 5-metric row: indoor temp · humidity · pressure · wind · rain */}
      <div className="flex flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <MetricCell
          label="In Temp" value={fmt(r?.insideTempC ?? null)} unit="°C"
          sub={r?.inTempDayHighC != null
            ? `H ${r.inTempDayHighC.toFixed(1)}  L ${r.inTempDayLowC?.toFixed(1) ?? '—'}`
            : undefined}
        />
        <MetricCell
          label="Humidity" value={fmt(r?.outsideHumidityPercent ?? null, 0)} unit="%"
          sub={r?.dewpointC != null ? `Dew ${r.dewpointC.toFixed(1)}°C` : undefined}
        />
        <MetricCell
          label="Pressure" value={fmt(r?.barometerHpa ?? null, 1)} unit="hPa"
          sub={r?.baroDayHighHpa != null
            ? `H ${r.baroDayHighHpa.toFixed(0)}  L ${r.baroDayLowHpa?.toFixed(0) ?? '—'}`
            : undefined}
        />
        <MetricCell
          label="Wind" value={fmt(r?.windSpeedMs ?? null)} unit="m/s"
          sub={windSub || undefined}
        />
        <MetricCell
          label="Rain today" value={fmt(r?.dailyRainMm ?? null)} unit="mm"
          sub={r?.rainRateMmHr != null ? `Rate ${r.rainRateMmHr.toFixed(1)} mm/h` : undefined}
        />
      </div>
    </div>
  );
}
