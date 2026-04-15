import { useTranslations } from 'next-intl';
import { WeatherReading } from './types';

function fmt(v: number | null, d = 1): string {
  return v != null ? v.toFixed(d) : '—';
}

export default function RainCard({ reading }: { reading: WeatherReading | null }) {
  const t = useTranslations('weather');

  return (
    <div className="card p-5 h-full">
      <p className="label mb-3">{t('dailyRain')}</p>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-light" style={{ color: 'var(--ink)' }}>
          {fmt(reading?.dailyRainMm ?? null)}
        </span>
        <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>mm</span>
      </div>

      <div className="space-y-1 text-xs mt-3" style={{ color: 'var(--ink-secondary)' }}>
        <p>{t('rainRate', { rate: fmt(reading?.rainRateMmHr ?? null) })}</p>
        <p>{t('rainLastHour', { amount: fmt(reading?.lastHourRainMm ?? null) })}</p>
        <p>{t('rainLast15min', { amount: fmt(reading?.last15MinRainMm ?? null) })}</p>
      </div>
    </div>
  );
}
