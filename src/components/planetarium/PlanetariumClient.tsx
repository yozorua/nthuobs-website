'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

interface PlanetariumClientProps {
  locale: string;
}

const STELLARIUM_BASE = '/stellarium/';

export default function PlanetariumClient({ locale: _locale }: PlanetariumClientProps) {
  const t = useTranslations('planetarium');
  const [iframeError, setIframeError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const searchParams = useSearchParams();
  const objectName = searchParams.get('object');
  const STELLARIUM_URL = objectName
    ? `${STELLARIUM_BASE}skysource/${encodeURIComponent(objectName)}`
    : STELLARIUM_BASE;

  return (
    <div className="relative" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {!loaded && !iframeError && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          style={{ background: 'var(--bg)', zIndex: 10 }}
        >
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--line)', borderTopColor: 'var(--ink-faint)' }}
          />
          <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--ink-faint)' }}>
            {t('loading')}
          </p>
        </div>
      )}

      {iframeError ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center"
          style={{ background: 'var(--bg)' }}
        >
          <p className="text-sm tracking-wide" style={{ color: 'var(--ink-secondary)' }}>
            {t('blockedMessage')}
          </p>
          <a
            href={STELLARIUM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm tracking-wide transition-colors duration-150"
            style={{ color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
          >
            {t('openStellarium')}
          </a>
        </div>
      ) : (
        <iframe
          src={STELLARIUM_URL}
          title="Stellarium Web Planetarium"
          className="w-full h-full border-0"
          onLoad={() => setLoaded(true)}
          onError={() => setIframeError(true)}
          allow="fullscreen"
        />
      )}
    </div>
  );
}
