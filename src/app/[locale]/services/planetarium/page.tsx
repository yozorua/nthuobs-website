import { Metadata } from 'next';
import PlanetariumClient from '@/components/planetarium/PlanetariumClient';

export const metadata: Metadata = { title: 'Planetarium' };

export default async function PlanetariumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PlanetariumClient locale={locale} />;
}
