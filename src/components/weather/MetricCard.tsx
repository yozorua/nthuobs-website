import { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hi?: number | null;
  lo?: number | null;
  hiUnit?: string;
  loUnit?: string;
  children?: ReactNode;
}

export default function MetricCard({
  label,
  value,
  unit,
  hi,
  lo,
  hiUnit,
  loUnit,
  children,
}: MetricCardProps) {
  const fmt = (v: number | null | undefined, u?: string) =>
    v != null ? `${v.toFixed(1)}${u ?? ''}` : '—';

  return (
    <div className="card p-5" style={{ borderColor: 'var(--line)' }}>
      <p className="label mb-3">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-light tracking-tight" style={{ color: 'var(--ink)' }}>
          {value}
        </span>
        {unit && (
          <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {unit}
          </span>
        )}
      </div>
      {(hi != null || lo != null) && (
        <p className="text-xs mt-2" style={{ color: 'var(--ink-faint)' }}>
          H: {fmt(hi, hiUnit ?? unit)} / L: {fmt(lo, loUnit ?? unit)}
        </p>
      )}
      {children}
    </div>
  );
}
