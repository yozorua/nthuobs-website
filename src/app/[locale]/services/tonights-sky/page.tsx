import { Metadata } from 'next';
import TonightsSkyClient from '@/components/tonights-sky/TonightsSkyClient';

export const metadata: Metadata = { title: "Tonight's Sky" };

export default async function TonightsSkyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <TonightsSkyClient locale={locale} />;
}
