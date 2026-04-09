import { useTranslations } from 'next-intl';
import { MeteoblueForecastEntry } from './types';

function cloudColor(pct: string): string {
  const n = parseInt(pct, 10);
  if (isNaN(n)) return 'var(--ink-faint)';
  if (n <= 20) return '#22c55e';
  if (n <= 50) return '#eab308';
  if (n <= 80) return '#f97316';
  return '#ef4444';
}

function seeingColor(arcsec: string): string {
  const n = parseFloat(arcsec);
  if (isNaN(n)) return 'var(--ink-faint)';
  if (n <= 1.0) return '#22c55e';
  if (n <= 2.0) return '#86efac';
  if (n <= 3.0) return '#eab308';
  return '#ef4444';
}

interface Props {
  forecast: MeteoblueForecastEntry[];
  stationDate: string;
}

export default function CloudSeeingGrid({ forecast, stationDate }: Props) {
  const t = useTranslations('weather');

  // Show today + tomorrow, up to 24 entries
  const entries = forecast
    .filter((e) => e.date === stationDate || forecast.findIndex(f => f.date === stationDate) === -1)
    .slice(0, 24);

  if (entries.length === 0) return null;

  return (
    <div className="card p-5" style={{ borderColor: 'var(--line)' }}>
      <p className="label mb-4">{t('cloudSeeing')}</p>

      <div className="overflow-x-auto">
        <table className="text-xs min-w-max">
          <thead>
            <tr style={{ color: 'var(--ink-faint)' }}>
              <th className="text-left pr-4 py-1 font-normal">Date</th>
              <th className="text-left pr-4 py-1 font-normal">Hr</th>
              <th className="text-right pr-4 py-1 font-normal">{t('cloudHigh')}</th>
              <th className="text-right pr-4 py-1 font-normal">{t('cloudMid')}</th>
              <th className="text-right pr-4 py-1 font-normal">{t('cloudLow')}</th>
              <th className="text-right py-1 font-normal">{t('seeing')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                <td className="pr-4 py-1" style={{ color: 'var(--ink-faint)' }}>{e.date}</td>
                <td className="pr-4 py-1" style={{ color: 'var(--ink-secondary)' }}>
                  {e.time.padStart(2, '0')}:00
                </td>
                <td className="text-right pr-4 py-1 font-medium" style={{ color: cloudColor(e.clouds_high) }}>
                  {e.clouds_high}%
                </td>
                <td className="text-right pr-4 py-1 font-medium" style={{ color: cloudColor(e.clouds_mid) }}>
                  {e.clouds_mid}%
                </td>
                <td className="text-right pr-4 py-1 font-medium" style={{ color: cloudColor(e.clouds_low) }}>
                  {e.clouds_low}%
                </td>
                <td className="text-right py-1 font-medium" style={{ color: seeingColor(e.seeing) }}>
                  {e.seeing}&Prime;
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
