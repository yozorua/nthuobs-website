import { useTranslations } from 'next-intl';
import { WeatherReading } from './types';

function TimelineBar({ sunrise, sunset }: { sunrise?: string | null; sunset?: string | null }) {
  if (!sunrise || !sunset) return null;

  const toMinutes = (t: string) => {
    const parts = t.split(':').map(Number);
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  };

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const riseMin = toMinutes(sunrise);
  const setMin = toMinutes(sunset);
  const total = 24 * 60;

  const risePercent = (riseMin / total) * 100;
  const setPercent = (setMin / total) * 100;
  const dayWidth = setPercent - risePercent;
  const nowPercent = (nowMin / total) * 100;

  return (
    <div className="mt-3 relative h-2 rounded-full" style={{ background: 'var(--bg-muted)' }}>
      {/* Day band */}
      <div
        className="absolute top-0 h-full rounded-full"
        style={{
          left: `${risePercent}%`,
          width: `${dayWidth}%`,
          background: 'var(--accent)',
          opacity: 0.35,
        }}
      />
      {/* Now marker */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
        style={{ left: `${nowPercent}%`, background: 'var(--ink)', transform: 'translate(-50%, -50%)' }}
      />
    </div>
  );
}

export default function SunMoonCard({ reading }: { reading: WeatherReading | null }) {
  const t = useTranslations('weather');

  return (
    <div className="card p-5">
      <p className="label mb-3">{t('sunMoon')}</p>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <div>
          <span style={{ color: 'var(--ink-faint)' }}>{t('sunrise')}  </span>
          <span style={{ color: 'var(--ink)' }}>{reading?.sunrise ?? '—'}</span>
        </div>
        <div>
          <span style={{ color: 'var(--ink-faint)' }}>{t('sunset')}  </span>
          <span style={{ color: 'var(--ink)' }}>{reading?.sunset ?? '—'}</span>
        </div>
        <div>
          <span style={{ color: 'var(--ink-faint)' }}>{t('moonrise')}  </span>
          <span style={{ color: 'var(--ink)' }}>{reading?.moonrise ?? '—'}</span>
        </div>
        <div>
          <span style={{ color: 'var(--ink-faint)' }}>{t('moonset')}  </span>
          <span style={{ color: 'var(--ink)' }}>{reading?.moonset ?? '—'}</span>
        </div>
      </div>

      {reading?.moonPhase && (
        <p className="text-xs mt-2" style={{ color: 'var(--ink-secondary)' }}>
          {t('moonPhase')}: {reading.moonPhase}%
        </p>
      )}

      <TimelineBar sunrise={reading?.sunrise} sunset={reading?.sunset} />
    </div>
  );
}
