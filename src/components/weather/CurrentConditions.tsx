import { useTranslations } from 'next-intl';
import MetricCard from './MetricCard';
import { WeatherReading } from './types';

function fmt(v: number | null, decimals = 1): string {
  return v != null ? v.toFixed(decimals) : '—';
}

function deriveCondition(r: WeatherReading | null): string {
  if (!r) return 'Unknown';
  if ((r.rainRateMmHr ?? 0) > 0) return 'Rainy';
  const cloud = Math.max(r.cloudCoverLow ?? 0, r.cloudCoverMid ?? 0, r.cloudCoverHigh ?? 0);
  if (cloud > 80) return 'Cloudy';
  if (cloud > 40) return 'PartlyCloudy';
  if ((r.windSpeedMs ?? 0) >= 10) return 'Windy';
  return 'Clear';
}

export default function CurrentConditions({ reading }: { reading: WeatherReading | null }) {
  const t = useTranslations('weather');
  const condition = deriveCondition(reading);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <MetricCard
        label={t('outdoorTemp')}
        value={fmt(reading?.outsideTempC ?? null)}
        unit="°C"
        hi={reading?.outTempDayHighC ?? null}
        lo={reading?.outTempDayLowC ?? null}
      />
      <MetricCard
        label={t('indoorTemp')}
        value={fmt(reading?.insideTempC ?? null)}
        unit="°C"
        hi={reading?.inTempDayHighC ?? null}
        lo={reading?.inTempDayLowC ?? null}
      />
      <MetricCard
        label={t('outdoorHumidity')}
        value={fmt(reading?.outsideHumidityPercent ?? null, 0)}
        unit="%"
      />
      <MetricCard
        label={t('indoorHumidity')}
        value={fmt(reading?.insideHumidityPercent ?? null, 0)}
        unit="%"
      />
      <MetricCard
        label={t('barometer')}
        value={fmt(reading?.barometerHpa ?? null, 1)}
        unit="hPa"
        hi={reading?.baroDayHighHpa ?? null}
        lo={reading?.baroDayLowHpa ?? null}
      />

      {/* Condition card */}
      <div className="card p-5" style={{ borderColor: 'var(--line)' }}>
        <p className="label mb-3">{t('condition')}</p>
        <p className="text-2xl font-light" style={{ color: 'var(--ink)' }}>
          {t(`conditions.${condition}`)}
        </p>
        {reading?.dewpointC != null && (
          <p className="text-xs mt-2" style={{ color: 'var(--ink-faint)' }}>
            Dewpoint: {reading.dewpointC.toFixed(1)}°C
          </p>
        )}
      </div>
    </div>
  );
}
