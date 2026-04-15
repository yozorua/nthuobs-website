'use client';

import { useEffect, useState } from 'react';
import { WeatherReading } from './types';

// ── SQM data shape ─────────────────────────────────────────────────────────
interface SqmStats {
  last: number | null;
  avg:  number | null;
  max:  number | null;
  min:  number | null;
}

function useSqm(): SqmStats {
  const [sqm, setSqm] = useState<SqmStats>({ last: null, avg: null, max: null, min: null });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/allsky/sqm');
        if (!res.ok) return;
        const data = await res.json() as Record<string, unknown>;
        const raw = data?.camera_sqm_mag_data as Record<string, number> | undefined;
        if (!raw) return;
        setSqm({
          last: raw.last  ?? null,
          avg:  raw.avg   ?? null,
          max:  raw.max   ?? null,
          min:  raw.min   ?? null,
        });
      } catch { /* silent */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  return sqm;
}

function fmt(v: number | null, d = 1): string {
  return v != null ? v.toFixed(d) : '—';
}

function fmtInt(v: number | null): string {
  return v != null ? Math.round(v).toString() : '—';
}

// ── Condition icons — 48×48 viewBox, white stroke, no fill ──────────────────
function ConditionIcon({ cond, isNight, size = 64 }: { cond: string; isNight: boolean; size?: number }) {
  const v = 48;
  const st = {
    stroke: 'rgba(255,255,255,0.88)',
    strokeWidth: 2.2,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

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

  const Cloud = ({ xl = 4, xr = 44, yt = 16, yb = 36, style = st }: {
    xl?: number; xr?: number; yt?: number; yb?: number; style?: typeof st;
  }) => {
    const w = xr - xl, h = yb - yt;
    const d = [
      `M ${xl} ${yb}`,
      `Q ${xl} ${yt + h * 0.5} ${xl + w * 0.15} ${yt + h * 0.35}`,
      `Q ${xl + w * 0.18} ${yt} ${xl + w * 0.38} ${yt + h * 0.1}`,
      `Q ${xl + w * 0.45} ${yt - h * 0.18} ${xl + w * 0.62} ${yt + h * 0.05}`,
      `Q ${xl + w * 0.75} ${yt - h * 0.1} ${xl + w * 0.85} ${yt + h * 0.25}`,
      `Q ${xr} ${yt + h * 0.35} ${xr} ${yt + h * 0.6}`,
      `Q ${xr} ${yb} ${xr - w * 0.1} ${yb}`,
      `L ${xl} ${yb} Z`,
    ].join(' ');
    return <path d={d} {...style} />;
  };

  const Drops = ({ baseY, xl = 10, xr = 38 }: { baseY: number; xl?: number; xr?: number }) => {
    const xs = [xl, xl + (xr - xl) / 3, xl + (xr - xl) * 2 / 3, xr];
    return <>{xs.map((x, i) => (
      <line key={i} x1={x} y1={baseY} x2={x - 3} y2={baseY + 7} {...st} />
    ))}</>;
  };

  let icon: React.ReactNode;
  switch (cond) {
    case 'Clear':
      icon = isNight
        ? (() => {
            // Crescent moon: full circle arc then inner concave arc
            const cx = 24, cy = 24, r = 12, ir = 9.5;
            const d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${ir} ${ir} 0 1 0 ${cx} ${cy - r} Z`;
            return (
              <path d={d}
                fill="rgba(255,248,200,0.88)"
                stroke="rgba(255,255,255,0.65)"
                strokeWidth={1.4}
                transform={`rotate(-30, ${cx}, ${cy})`}
              />
            );
          })()
        : <Sun cx={24} cy={24} r={9} rl={5} rays={8} />;
      break;
    case 'PartlyCloudy':
      icon = isNight
        ? (() => {
            // Small crescent in upper-right + cloud below
            const cx = 34, cy = 12, r = 7, ir = 5.5;
            const d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${ir} ${ir} 0 1 0 ${cx} ${cy - r} Z`;
            return (
              <>
                <path d={d}
                  fill="rgba(255,248,200,0.80)"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth={1.2}
                  transform={`rotate(-30, ${cx}, ${cy})`}
                  opacity={0.85}
                />
                <Cloud xl={2} xr={40} yt={24} yb={42} />
              </>
            );
          })()
        : (
          <>
            <Sun cx={34} cy={13} r={7} rl={4} rays={6} opacity={0.80} />
            <Cloud xl={2} xr={40} yt={24} yb={42} />
          </>
        );
      break;
    case 'Cloudy':
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
      icon = (
        <>
          <path d="M 4 14 Q 16 10 28 14 Q 36 18 34 22 Q 32 26 24 22" {...st} />
          <path d="M 4 24 Q 14 20 26 24 Q 36 28 34 32 Q 32 36 22 32" {...st} />
          <path d="M 8 34 Q 20 30 32 34 Q 40 38 38 42" {...st} />
        </>
      );
      break;
    default:
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

// ── Indoor metric cell ───────────────────────────────────────────────────────
function IndoorCell({ label, value, unit, hiLo }: {
  label: string;
  value: string;
  unit: string;
  hiLo: string;
}) {
  return (
    <div className="flex-1 min-w-[100px] px-5 py-3"
         style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[10px] uppercase tracking-widest mb-1.5"
           style={{ color: 'var(--ink-faint)' }}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-light"
              style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{unit}</span>
      </div>
      <div className="text-[10px] mt-1" style={{ color: 'var(--ink-faint)' }}>
        {hiLo}
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
  reading: WeatherReading | null;
  condition: string;
  conditionKey: string;
  isNight: boolean;
}

export default function InstrumentPanel({ reading, condition, conditionKey, isNight }: Props) {
  const r = reading;
  const sqm = useSqm();

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

      {/* ── Hero: icon · condition · outdoor temp + outdoor humidity ── */}
      <div className="flex items-center gap-6 px-6 py-5">
        <ConditionIcon cond={conditionKey} isNight={isNight} size={68} />

        <div className="flex-1 min-w-0">
          <div className="text-sm font-light tracking-[0.18em] uppercase mb-3"
               style={{ color: 'var(--ink-muted)' }}>
            {condition}
          </div>

          <div className="flex items-end gap-8 flex-wrap">
            {/* Outdoor temperature */}
            <div>
              <div className="flex items-start gap-1 leading-none">
                <span className="text-6xl font-extralight"
                      style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {r?.outsideTempC != null ? r.outsideTempC.toFixed(1) : '—'}
                </span>
                <span className="text-2xl mt-1" style={{ color: 'var(--ink-muted)' }}>°C</span>
              </div>
              <div className="text-xs mt-1.5" style={{ color: 'var(--ink-faint)' }}>
                H {fmt(r?.outTempDayHighC ?? null)}° · L {fmt(r?.outTempDayLowC ?? null)}°
              </div>
            </div>

            {/* Vertical rule */}
            <div style={{ width: 1, height: 52, background: 'rgba(255,255,255,0.14)', flexShrink: 0 }} />

            {/* Outdoor humidity */}
            <div>
              <div className="flex items-start gap-1 leading-none">
                <span className="text-6xl font-extralight"
                      style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {r?.outsideHumidityPercent != null ? fmtInt(r.outsideHumidityPercent) : '—'}
                </span>
                <span className="text-2xl mt-1" style={{ color: 'var(--ink-muted)' }}>%</span>
              </div>
              <div className="text-xs mt-1.5" style={{ color: 'var(--ink-faint)' }}>
                H {fmtInt(r?.outsideHumidityDayHigh ?? null)}% · L {fmtInt(r?.outsideHumidityDayLow ?? null)}%
                {r?.dewpointC != null && ` · Dew ${fmt(r.dewpointC)}°C`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Indoor metrics row ── */}
      <div className="flex flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <IndoorCell
          label="In Temp"
          value={r?.insideTempC != null ? r.insideTempC.toFixed(1) : '—'}
          unit="°C"
          hiLo={`H ${fmt(r?.inTempDayHighC ?? null)}° · L ${fmt(r?.inTempDayLowC ?? null)}°`}
        />
        <IndoorCell
          label="In Humid"
          value={fmtInt(r?.insideHumidityPercent ?? null)}
          unit="%"
          hiLo={`H ${fmtInt(r?.insideHumidityDayHigh ?? null)}% · L ${fmtInt(r?.insideHumidityDayLow ?? null)}%`}
        />
        <IndoorCell
          label="Pressure"
          value={r?.barometerHpa != null ? r.barometerHpa.toFixed(1) : '—'}
          unit="hPa"
          hiLo={`H ${fmt(r?.baroDayHighHpa ?? null, 0)} hPa · L ${fmt(r?.baroDayLowHpa ?? null, 0)} hPa`}
        />
        <IndoorCell
          label="SQM"
          value={sqm.last != null ? sqm.last.toFixed(2) : '—'}
          unit="mag/arcsec²"
          hiLo={
            sqm.avg != null
              ? `avg ${sqm.avg.toFixed(2)} · max ${sqm.max?.toFixed(2) ?? '—'} · min ${sqm.min?.toFixed(2) ?? '—'}`
              : '—'
          }
        />
      </div>
    </div>
  );
}
