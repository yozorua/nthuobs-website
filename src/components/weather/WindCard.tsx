import { useTranslations } from 'next-intl';
import { WeatherReading } from './types';

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

function dirArrow(deg: number | null): string {
  if (deg == null) return '—';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function fmt(v: number | null, d = 1): string {
  return v != null ? v.toFixed(d) : '—';
}

export default function WindCard({ reading }: { reading: WeatherReading | null }) {
  const t = useTranslations('weather');
  const bf = beaufort(reading?.windSpeedMs ?? null);

  return (
    <div className="card p-5">
      <p className="label mb-3">{t('wind')}</p>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-light" style={{ color: 'var(--ink)' }}>
          {fmt(reading?.windSpeedMs ?? null)}
        </span>
        <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>m/s</span>
        <span className="text-sm ml-2" style={{ color: 'var(--ink-secondary)' }}>
          {reading?.windDirectionText ?? dirArrow(reading?.windDirectionDeg ?? null)}
        </span>
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--ink-faint)' }}>
        {t('windBeaufort', { force: bf })}
      </p>

      <div className="space-y-1 text-xs" style={{ color: 'var(--ink-secondary)' }}>
        {reading?.windGustMs != null && (
          <p>{t('windGust', { speed: fmt(reading.windGustMs), force: beaufort(reading.windGustMs) })}</p>
        )}
        {reading?.avgWind1MinMs != null && (
          <p>{t('windAvg1m', { speed: fmt(reading.avgWind1MinMs) })}</p>
        )}
        {reading?.avgWind10MinMs != null && (
          <p>{t('windAvg10m', { speed: fmt(reading.avgWind10MinMs) })}</p>
        )}
        {reading?.hiWind10MinMs != null && (
          <p>{t('windHigh10m', { speed: fmt(reading.hiWind10MinMs) })}</p>
        )}
      </div>
    </div>
  );
}
