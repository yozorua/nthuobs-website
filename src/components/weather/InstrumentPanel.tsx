'use client';

import { WeatherReading } from './types';

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt(v: number | null, d = 1): string {
  return v != null ? v.toFixed(d) : '—';
}

// ── Condition icon (inline SVG, white stroke) ─────────────────────────────
function ConditionIcon({ cond, size = 64 }: { cond: string; size?: number }) {
  const s = size;
  const cx = s / 2, cy = s / 2;
  const st = { stroke: 'rgba(255,255,255,0.90)', strokeWidth: s * 0.048, fill: 'none',
               strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  // ---- reusable pieces ----
  const sunCircle = <circle cx={cx} cy={cy} r={s * 0.175} {...st} />;
  const sunRays = [0,45,90,135,180,225,270,315].map(a => {
    const rad = a * Math.PI / 180;
    const r1 = s * 0.265, r2 = s * 0.36;
    return (
      <line key={a}
        x1={cx + r1 * Math.cos(rad)} y1={cy + r1 * Math.sin(rad)}
        x2={cx + r2 * Math.cos(rad)} y2={cy + r2 * Math.sin(rad)}
        {...st} />
    );
  });

  // Cloud path fits in a 48×48 grid, scaled to `s`
  const sc = s / 48;
  const cloudD = `M ${8*sc} ${34*sc} Q ${3*sc} ${34*sc} ${3*sc} ${28*sc} Q ${3*sc} ${21*sc} ${10*sc} ${21*sc} Q ${11*sc} ${13*sc} ${19*sc} ${13*sc} Q ${24*sc} ${7*sc} ${31*sc} ${13*sc} Q ${38*sc} ${11*sc} ${40*sc} ${18*sc} Q ${46*sc} ${18*sc} ${46*sc} ${25*sc} Q ${46*sc} ${32*sc} ${40*sc} ${33*sc} H ${8*sc} Z`;

  switch (cond) {
    case 'Clear':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          {sunCircle}
          {sunRays}
        </svg>
      );

    case 'PartlyCloudy': {
      // Small sun in top-right corner
      const scx = cx + s * 0.14, scy = cy - s * 0.16;
      const sr = s * 0.12;
      const sRays = [0,60,120,180,240,300].map(a => {
        const rad = a * Math.PI / 180;
        return <line key={a}
          x1={scx + (sr+s*0.04)*Math.cos(rad)} y1={scy + (sr+s*0.04)*Math.sin(rad)}
          x2={scx + (sr+s*0.10)*Math.cos(rad)} y2={scy + (sr+s*0.10)*Math.sin(rad)}
          {...st} />;
      });
      // Cloud shifted down-left slightly
      const cloud2sc = s / 48;
      const off = s * 0.06;
      const cloudD2 = `M ${(8*cloud2sc)+off} ${(36*cloud2sc)} Q ${(3*cloud2sc)+off} ${36*cloud2sc} ${(3*cloud2sc)+off} ${(29*cloud2sc)} Q ${(3*cloud2sc)+off} ${(22*cloud2sc)} ${(10*cloud2sc)+off} ${(22*cloud2sc)} Q ${(11*cloud2sc)+off} ${(15*cloud2sc)} ${(19*cloud2sc)+off} ${(15*cloud2sc)} Q ${(23*cloud2sc)+off} ${(10*cloud2sc)} ${(29*cloud2sc)+off} ${(15*cloud2sc)} Q ${(35*cloud2sc)+off} ${(13*cloud2sc)} ${(37*cloud2sc)+off} ${(19*cloud2sc)} Q ${(43*cloud2sc)+off} ${(19*cloud2sc)} ${(43*cloud2sc)+off} ${(26*cloud2sc)} Q ${(43*cloud2sc)+off} ${(33*cloud2sc)} ${(37*cloud2sc)+off} ${(34*cloud2sc)} H ${(8*cloud2sc)+off} Z`;
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <circle cx={scx} cy={scy} r={sr} {...st} />
          {sRays}
          <path d={cloudD2} {...st} />
        </svg>
      );
    }

    case 'Cloudy':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          {/* Back cloud (faint) */}
          <path d={`M ${10*sc} ${28*sc} Q ${5*sc} ${28*sc} ${5*sc} ${22*sc} Q ${5*sc} ${16*sc} ${11*sc} ${16*sc} Q ${13*sc} ${10*sc} ${20*sc} ${11*sc} Q ${25*sc} ${6*sc} ${31*sc} ${11*sc} Q ${37*sc} ${9*sc} ${39*sc} ${16*sc} Q ${44*sc} ${16*sc} ${44*sc} ${22*sc} Q ${44*sc} ${28*sc} ${38*sc} ${28*sc} H ${10*sc} Z`}
            {...st} style={{ ...st, stroke: 'rgba(255,255,255,0.45)' }} />
          {/* Front cloud */}
          <path d={cloudD} {...st} />
        </svg>
      );

    case 'Rainy':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <path d={cloudD} {...st} />
          {/* Rain drops */}
          {[13,20,27,34].map((x, i) => (
            <line key={i}
              x1={x*sc} y1={38*sc} x2={(x-3)*sc} y2={45*sc}
              {...st} />
          ))}
        </svg>
      );

    case 'Windy':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          {/* Three wind arcs */}
          <path d={`M ${6*sc} ${16*sc} Q ${20*sc} ${12*sc} ${32*sc} ${16*sc} Q ${42*sc} ${20*sc} ${38*sc} ${24*sc} Q ${34*sc} ${28*sc} ${26*sc} ${24*sc}`} {...st} />
          <path d={`M ${6*sc} ${26*sc} Q ${18*sc} ${22*sc} ${30*sc} ${26*sc} Q ${40*sc} ${30*sc} ${36*sc} ${34*sc} Q ${32*sc} ${38*sc} ${24*sc} ${34*sc}`} {...st} />
          <path d={`M ${10*sc} ${36*sc} Q ${22*sc} ${32*sc} ${34*sc} ${36*sc} Q ${44*sc} ${40*sc} ${40*sc} ${44*sc}`} {...st} />
        </svg>
      );

    default:
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          {[10,24,38].map(x => (
            <circle key={x} cx={x*sc} cy={cy} r={s*0.06} fill="rgba(255,255,255,0.5)" />
          ))}
        </svg>
      );
  }
}

// ── Secondary metric cell ────────────────────────────────────────────────────
function MetricCell({ label, value, unit, sub }: { label: string; value: string; unit: string; sub?: string }) {
  return (
    <div className="flex-1 min-w-[90px] px-4 py-3" style={{ borderRight: '1px solid rgba(255,255,255,0.10)' }}>
      <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--ink-faint)' }}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-light" style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {unit && <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{unit}</span>}
      </div>
      {sub && <div className="text-[10px] mt-1" style={{ color: 'var(--ink-faint)' }}>{sub}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
interface Props {
  reading: WeatherReading | null;
  lastUpdate: string;
  condition: string;   // translated label
  conditionKey: string; // 'Clear' | 'Cloudy' | …
}

export default function InstrumentPanel({ reading, lastUpdate, condition, conditionKey }: Props) {
  const outTemp = reading?.outsideTempC ?? null;
  const inTemp  = reading?.insideTempC  ?? null;
  const humid   = reading?.outsideHumidityPercent ?? null;
  const baro    = reading?.barometerHpa ?? null;
  const dew     = reading?.dewpointC ?? null;

  return (
    <div
      style={{
        border: '1px solid var(--card-border)',
        borderTop: '2px solid rgba(255,255,255,0.40)',
        background: 'var(--card-bg)',
        backdropFilter: 'var(--card-glass)',
        WebkitBackdropFilter: 'var(--card-glass)',
      }}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 py-1.5"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.06)' }}>
        <span className="text-[10px]" style={{ color: 'var(--ink-faint)', letterSpacing: '0.05em' }}>
          24°47′N  120°59′E  EL 55 m
        </span>
        <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
          UPDATED  {lastUpdate}
        </span>
      </div>

      {/* Hero: icon + condition + big temp */}
      <div className="flex items-center gap-5 px-6 py-5">
        <ConditionIcon cond={conditionKey} size={64} />
        <div className="flex-1">
          <div className="text-base font-light tracking-widest uppercase mb-1"
               style={{ color: 'var(--ink-muted)' }}>
            {condition}
          </div>
          <div className="flex items-start gap-1 leading-none">
            <span className="text-6xl font-extralight" style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {outTemp != null ? outTemp.toFixed(1) : '—'}
            </span>
            <span className="text-2xl mt-1" style={{ color: 'var(--ink-muted)' }}>°C</span>
          </div>
          {(reading?.outTempDayHighC != null || reading?.outTempDayLowC != null) && (
            <div className="text-xs mt-1.5" style={{ color: 'var(--ink-faint)' }}>
              H {fmt(reading?.outTempDayHighC ?? null)}°  ·  L {fmt(reading?.outTempDayLowC ?? null)}°
            </div>
          )}
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="flex flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <MetricCell
          label="In Temp"
          value={fmt(inTemp)}
          unit="°C"
          sub={reading?.inTempDayHighC != null
            ? `H ${reading.inTempDayHighC.toFixed(1)}  L ${reading.inTempDayLowC?.toFixed(1) ?? '—'}`
            : undefined}
        />
        <MetricCell
          label="Humidity"
          value={fmt(humid, 0)}
          unit="%"
          sub={dew != null ? `Dew ${dew.toFixed(1)}°C` : undefined}
        />
        <MetricCell
          label="Pressure"
          value={fmt(baro, 1)}
          unit="hPa"
          sub={reading?.baroDayHighHpa != null
            ? `H ${reading.baroDayHighHpa.toFixed(0)}  L ${reading.baroDayLowHpa?.toFixed(0) ?? '—'}`
            : undefined}
        />
      </div>
    </div>
  );
}
