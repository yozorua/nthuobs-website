'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ALLSKY_REFRESH_INTERVAL_MS } from '@/config/observatory';

export default function AllSkyCamera() {
  const t = useTranslations('weather');
  const [src, setSrc] = useState(`/api/allsky/image?t=${Date.now()}`);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSrc(`/api/allsky/image?t=${Date.now()}`);
      setError(false);
    }, ALLSKY_REFRESH_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  return (
    <>
      {/* Card — no header, image fills entire card height */}
      <div
        className="card p-0 overflow-hidden h-full"
        style={{
          position: 'relative',
          cursor: error ? 'default' : 'zoom-in',
          background: 'rgba(0,0,0,0.30)',
        }}
        onClick={() => !error && setFullscreen(true)}
      >
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-center px-4" style={{ color: 'var(--ink-faint)' }}>
              {t('allSkyCameraPlaceholder')}
            </p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={t('allSkyCamera')}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'contain' }}
            onError={() => setError(true)}
          />
        )}
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setFullscreen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={t('allSkyCamera')}
            className="max-w-full max-h-full object-contain"
            style={{ maxWidth: '92vw', maxHeight: '92vh' }}
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-5 right-6 text-2xl leading-none"
            style={{ color: 'rgba(255,255,255,0.7)' }}
            onClick={() => setFullscreen(false)}
            aria-label="Close"
          >
            ✕
          </button>
          <span className="absolute bottom-5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {t('allSkyCamera')} · auto-refreshes every {Math.round(ALLSKY_REFRESH_INTERVAL_MS / 1000)}s
          </span>
        </div>
      )}
    </>
  );
}
