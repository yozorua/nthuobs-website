import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import WeatherDashboard from '@/components/weather/WeatherDashboard';

export const metadata: Metadata = { title: 'Weather Station' };

export default async function WeatherPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'weather' });

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
      <div className="mb-10 pb-8" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="label mb-3">{t('stationLocation')}</p>
        <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
          {t('pageTitle')}
        </h1>
      </div>
      <WeatherDashboard />
    </div>
  );
}
