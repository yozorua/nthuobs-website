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
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="label">{t('allSkyCamera')}</p>
        <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
          {Math.round(ALLSKY_REFRESH_INTERVAL_MS / 1000)}s refresh
        </span>
      </div>

      {error ? (
        <div
          className="flex items-center justify-center py-12"
          style={{ background: 'var(--bg-muted)' }}
        >
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>
            {t('allSkyCameraPlaceholder')}
          </p>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={t('allSkyCamera')}
          className="w-full h-auto block"
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}
