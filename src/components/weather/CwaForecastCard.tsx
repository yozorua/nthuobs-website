import { useTranslations } from 'next-intl';
import { CwaForecastPeriod } from './types';

function formatPeriod(start?: string, end?: string): string {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const fmt = (d: Date) =>
    d.toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  return e ? `${fmt(s)} – ${fmt(e)}` : fmt(s);
}

interface Props {
  periods: CwaForecastPeriod[];
}

export default function CwaForecastCard({ periods }: Props) {
  const t = useTranslations('weather');

  return (
    <div className="card p-5">
      <p className="label mb-3">{t('cwaForecast')}</p>

      {periods.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{t('cwaLoading')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
          {periods.slice(0, 8).map((p, i) => (
            <div key={i}>
              <p className="text-xs mb-0.5" style={{ color: 'var(--ink-faint)' }}>
                {formatPeriod(p.start, p.end)}
              </p>
              <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>
                {p.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
