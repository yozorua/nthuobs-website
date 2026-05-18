'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

export default function RadarCard() {
  const t = useTranslations('weather');
  const [src, setSrc] = useState(`/api/weather/radar?t=${Date.now()}`);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setSrc(`/api/weather/radar?t=${Date.now()}`);
      setError(false);
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  const overlay = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.92)',
      }}
      onClick={() => setFullscreen(false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={t('radarEcho')}
        style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain' }}
        onClick={e => e.stopPropagation()}
      />
      <button
        style={{
          position: 'absolute', top: 20, right: 24,
          fontSize: 24, lineHeight: 1, color: 'rgba(255,255,255,0.7)',
          background: 'none', border: 'none', cursor: 'pointer',
        }}
        onClick={() => setFullscreen(false)}
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );

  return (
    <>
      <div
        className="card p-0 overflow-hidden h-full flex flex-col"
        style={{ cursor: error ? 'default' : 'zoom-in', background: 'var(--card-bg)' }}
        onClick={() => !error && setFullscreen(true)}
      >
        {/* Title row — px-5 pt-5 matches other cards' p-5 */}
        <div className="px-5 pt-5 flex-shrink-0">
          <p className="label mb-3">{t('radarEcho')}</p>
        </div>

        {/* Image area */}
        <div className="relative flex-1" style={{ minHeight: 160 }}>
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-center px-4" style={{ color: 'var(--ink-faint)' }}>
                {t('radarUnavailable')}
              </p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={t('radarEcho')}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'contain' }}
              onError={() => setError(true)}
            />
          )}
        </div>
      </div>

      {fullscreen && createPortal(overlay, document.body)}
    </>
  );
}
