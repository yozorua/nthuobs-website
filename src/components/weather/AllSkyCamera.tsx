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

  // Close fullscreen on Escape
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  const image = error ? null : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={t('allSkyCamera')} className="w-full h-auto block" onError={() => setError(true)} />
  );

  const placeholder = (
    <div className="flex items-center justify-center py-12" style={{ background: 'var(--bg-muted)' }}>
      <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{t('allSkyCameraPlaceholder')}</p>
    </div>
  );

  return (
    <>
      <div className="card p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <p className="label">{t('allSkyCamera')}</p>
          <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
            {Math.round(ALLSKY_REFRESH_INTERVAL_MS / 1000)}s refresh
          </span>
        </div>

        {/* Image — click to fullscreen */}
        <div
          className="cursor-zoom-in relative"
          onClick={() => !error && setFullscreen(true)}
          title="Click to enlarge"
        >
          {error ? placeholder : image}
          {!error && (
            <div
              className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded-sm"
              style={{ background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.7)', pointerEvents: 'none' }}
            >
              ⛶ expand
            </div>
          )}
        </div>
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
          <span
            className="absolute bottom-5 text-xs"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            {t('allSkyCamera')} · auto-refreshes every {Math.round(ALLSKY_REFRESH_INTERVAL_MS / 1000)}s
          </span>
        </div>
      )}
    </>
  );
}
