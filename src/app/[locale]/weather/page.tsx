import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import WeatherDashboard from '@/components/weather/WeatherDashboard';

export const metadata: Metadata = { title: 'Live Weather' };

export default async function WeatherPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'weather' });

  return <WeatherDashboard title={t('pageTitle')} />;
}
