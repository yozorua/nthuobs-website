'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

const WIND_MAP_URL =
  'https://www.meteoblue.com/en/weather/maps/widget/24.794N120.992E70_Asia%2FTaipei?windAnimation=1&gust=0&satellite=0&cloudsAndPrecipitation=0&temperature=0&sunshine=0&extremeForecastIndex=0&geoloc=fixed&tempunit=C&windunit=m%252Fs&lengthunit=metric&zoom=7&autowidth=auto&user_key=83cacefb64f401b4&embed_key=1e1ca9e03d3eb2ec&sig=0d9b38e6284e6ea581cdf9097b21587397549e2b19c487538c2044ed987672b6';

const SATELLITE_URL =
  'https://www.meteoblue.com/en/weather/maps/widget/24.794N120.992E70_Asia%2FTaipei?windAnimation=0&gust=0&satellite=1&cloudsAndPrecipitation=0&temperature=0&sunshine=0&extremeForecastIndex=0&geoloc=fixed&tempunit=C&windunit=m%252Fs&lengthunit=metric&zoom=9&autowidth=auto&user_key=83cacefb64f401b4&embed_key=8009b4af2fc1af9f&sig=a3326c206b2aff123dc95db1b025947dabc9d884572c331032483a9088b4e8b2';

function EmbedFrame({ src, title, height = 280 }: { src: string; title: string; height?: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    // Detect X-Frame-Options denial: after a short delay, try to read contentDocument.
    // If it's null or throws a security error, the embed was blocked.
    const timer = setTimeout(() => {
      try {
        const doc = ref.current?.contentDocument;
        // doc is null when blocked by X-Frame-Options
        if (doc === null || doc === undefined) setBlocked(true);
      } catch {
        setBlocked(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (blocked) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height, background: 'var(--bg-muted)', color: 'var(--ink-faint)', fontSize: 12 }}
      >
        Embed available on the deployed site
      </div>
    );
  }

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      className="w-full"
      style={{ height, border: 'none' }}
      allowFullScreen
    />
  );
}

export default function MeteoblueEmbeds() {
  const t = useTranslations('weather');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card p-5">
        <p className="label mb-3">{t('windMap')}</p>
        <EmbedFrame src={WIND_MAP_URL} title="Wind Map" />
      </div>
      <div className="card p-5">
        <p className="label mb-3">{t('satellite')}</p>
        <EmbedFrame src={SATELLITE_URL} title="Satellite" />
      </div>
    </div>
  );
}
