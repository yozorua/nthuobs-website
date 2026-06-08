import { Metadata } from 'next';
import { Suspense } from 'react';
import PlanetariumClient from '@/components/planetarium/PlanetariumClient';

export const metadata: Metadata = { title: 'Planetarium' };

export default async function PlanetariumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <Suspense>
      <PlanetariumClient locale={locale} />
    </Suspense>
  );
}
