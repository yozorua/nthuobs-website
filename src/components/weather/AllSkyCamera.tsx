'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ALLSKY_REFRESH_INTERVAL_MS } from '@/config/observatory';

export default function AllSkyCamera() {
  const t = useTranslations('weather');
  const [src, setSrc] = useState(`/api/allsky/image?t=${Date.now()}`);
  const [error, setError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSrc(`/api/allsky/image?t=${Date.now()}`);
      setError(false);
    }, ALLSKY_REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="card p-5" style={{ borderColor: 'var(--line)' }}>
      <p className="label mb-3">{t('allSkyCamera')}</p>
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ background: 'var(--bg-muted)', minHeight: 200 }}
      >
        {error ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>
            {t('allSkyCameraPlaceholder')}
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={t('allSkyCamera')}
            className="w-full object-contain"
            onError={() => setError(true)}
          />
        )}
      </div>
    </div>
  );
}
