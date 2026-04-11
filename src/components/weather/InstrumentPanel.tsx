import { WeatherReading } from './types';

function fmt(v: number | null, decimals = 1): string {
  return v != null ? v.toFixed(decimals) : '—';
}

function beaufort(ms: number | null): number {
  if (ms == null) return 0;
  if (ms < 0.3) return 0;
  if (ms < 1.6) return 1;
  if (ms < 3.4) return 2;
  if (ms < 5.5) return 3;
  if (ms < 8.0) return 4;
  if (ms < 10.8) return 5;
  if (ms < 13.9) return 6;
  if (ms < 17.2) return 7;
  if (ms < 20.8) return 8;
  if (ms < 24.5) return 9;
  if (ms < 28.5) return 10;
  if (ms < 32.7) return 11;
  return 12;
}

function windDir(text: string | null | undefined, deg: number | null | undefined): string {
  if (text) return text;
  if (deg == null) return '—';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

interface CellProps {
  label: string;
  value: string;
  unit: string;
  sub?: string;
}

function Cell({ label, value, unit, sub }: CellProps) {
  return (
    <div
      className="flex-1 min-w-[110px] px-5 py-3"
      style={{ borderRight: '1px solid var(--card-border)' }}
    >
      <div className="label mb-2" style={{ letterSpacing: '0.1em' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-2xl font-light leading-none tracking-tight"
          style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            {unit}
          </span>
        )}
      </div>
      {sub && (
        <div className="text-[10px] mt-1.5 leading-none" style={{ color: 'var(--ink-muted)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

interface Props {
  reading: WeatherReading | null;
  lastUpdate: string;
  condition: string;
}

export default function InstrumentPanel({ reading, lastUpdate, condition }: Props) {
  const bf = beaufort(reading?.windSpeedMs ?? null);
  const dir = windDir(reading?.windDirectionText, reading?.windDirectionDeg);

  const cells: CellProps[] = [
    {
      label: 'OUT TEMP',
      value: fmt(reading?.outsideTempC ?? null),
      unit: '°C',
      sub:
        reading?.outTempDayHighC != null
          ? `H ${reading.outTempDayHighC.toFixed(1)}  L ${reading.outTempDayLowC?.toFixed(1) ?? '—'}`
          : undefined,
    },
    {
      label: 'IN TEMP',
      value: fmt(reading?.insideTempC ?? null),
      unit: '°C',
      sub:
        reading?.inTempDayHighC != null
          ? `H ${reading.inTempDayHighC.toFixed(1)}  L ${reading.inTempDayLowC?.toFixed(1) ?? '—'}`
          : undefined,
    },
    {
      label: 'HUMIDITY',
      value: fmt(reading?.outsideHumidityPercent ?? null, 0),
      unit: '%',
      sub: reading?.dewpointC != null ? `Dew  ${reading.dewpointC.toFixed(1)}°C` : undefined,
    },
    {
      label: 'PRESSURE',
      value: fmt(reading?.barometerHpa ?? null, 1),
      unit: 'hPa',
      sub:
        reading?.baroDayHighHpa != null
          ? `H ${reading.baroDayHighHpa.toFixed(0)}  L ${reading.baroDayLowHpa?.toFixed(0) ?? '—'}`
          : undefined,
    },
    {
      label: 'WIND',
      value: fmt(reading?.windSpeedMs ?? null),
      unit: 'm/s',
      sub: `${dir}  Bf ${bf}${reading?.windGustMs != null ? `  G ${reading.windGustMs.toFixed(1)}` : ''}`,
    },
    {
      label: 'RAIN TODAY',
      value: fmt(reading?.dailyRainMm ?? null),
      unit: 'mm',
      sub:
        reading?.rainRateMmHr != null
          ? `Rate  ${reading.rainRateMmHr.toFixed(1)} mm/h`
          : undefined,
    },
  ];

  return (
    <div
      style={{
        border: '1px solid var(--card-border)',
        borderTop: '2px solid var(--accent)',
        background: 'var(--card-bg)',
        backdropFilter: 'var(--card-glass)',
        WebkitBackdropFilter: 'var(--card-glass)',
      }}
    >
      {/* Status bar: coordinates + last update */}
      <div
        className="flex items-center justify-between px-5 py-1.5 gap-4"
        style={{ borderBottom: '1px solid var(--card-border)', background: 'var(--card-bg)' }}
      >
        <span className="text-[10px]" style={{ color: 'var(--ink-faint)', letterSpacing: '0.05em' }}>
          24°47′N  120°59′E  EL 55 m
        </span>
        <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
          UPDATED  {lastUpdate}
        </span>
      </div>

      {/* Condition band */}
      <div
        className="px-5 py-2.5 flex items-baseline gap-3"
        style={{ borderBottom: '1px solid var(--card-border)' }}
      >
        <span className="text-xl font-light tracking-wide" style={{ color: 'var(--ink)' }}>
          {condition}
        </span>
        {reading?.dewpointC != null && (
          <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
            Dewpoint {reading.dewpointC.toFixed(1)}°C
          </span>
        )}
      </div>

      {/* Readout cells */}
      <div className="flex flex-wrap">
        {cells.map((c, i) => (
          <Cell key={i} {...c} />
        ))}
      </div>
    </div>
  );
}
