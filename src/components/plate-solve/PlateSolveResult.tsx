'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';
import type { SolveResultData } from '@/app/[locale]/services/plate-solve/[id]/page';

interface Props {
  result: SolveResultData | null;
  expired: boolean;
  isSignedIn: boolean;
  isMember: boolean;
  locale: string;
}

function raToHMS(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  const h = d / 15;
  const hh = Math.floor(h);
  const m = (h - hh) * 60;
  const mm = Math.floor(m);
  const s = (m - mm) * 60;
  return `${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m ${s.toFixed(1).padStart(4, '0')}s`;
}

function decToDMS(deg: number): string {
  const sign = deg >= 0 ? '+' : '−';
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = Math.round(((abs - d) * 60 - m) * 60);
  return `${sign}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}′ ${String(s).padStart(2, '0')}″`;
}

function formatExpiry(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function PlateSolveResult({ result, expired, isSignedIn, isMember, locale }: Props) {
  const t = useTranslations('plateSolve');
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isSignedIn) {
    return (
      <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
        <p className="label mb-3">{t('serviceLabel')}</p>
        <h1 className="text-3xl mb-10" style={{ color: 'var(--ink)', fontWeight: 300 }}>{t('pageTitle')}</h1>
        <div className="p-12 flex flex-col items-center gap-4 text-center" style={{ border: '1px solid var(--line)' }}>
          <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>{t('signInRequired')}</p>
          <button onClick={() => signIn('google', { callbackUrl: window.location.href })} className="btn">
            {t('signIn')}
          </button>
        </div>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
        <p className="label mb-3">{t('serviceLabel')}</p>
        <h1 className="text-3xl mb-10" style={{ color: 'var(--ink)', fontWeight: 300 }}>{t('pageTitle')}</h1>
        <div className="p-12 text-center" style={{ border: '1px solid var(--line)' }}>
          <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>{t('memberOnly')}</p>
        </div>
      </div>
    );
  }

  if (expired || !result) {
    return (
      <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
        <p className="label mb-3">{t('serviceLabel')}</p>
        <h1 className="text-3xl mb-10" style={{ color: 'var(--ink)', fontWeight: 300 }}>{t('pageTitle')}</h1>
        <div className="p-12 text-center" style={{ border: '1px solid var(--line)' }}>
          <p className="text-sm mb-6" style={{ color: 'var(--ink-secondary)' }}>{t('resultNotFound')}</p>
          <Link href={`/${locale}/services/plate-solve`} className="btn">
            {t('backToSolve')}
          </Link>
        </div>
      </div>
    );
  }

  const metrics: { label: string; value: string }[] = [
    { label: t('raResult'),    value: raToHMS(result.ra) },
    { label: t('decResult'),   value: decToDMS(result.dec) },
    { label: t('pixscale'),    value: `${result.pixscale.toFixed(3)} ″/px` },
    { label: t('fov'),         value: `${result.width_deg.toFixed(2)}° × ${result.height_deg.toFixed(2)}°` },
    { label: t('orientation'), value: `${result.orientation.toFixed(1)}° E of N` },
    { label: t('parity'),      value: result.parity === 'pos' ? t('parityPos') : result.parity === 'neg' ? t('parityNeg') : '—' },
  ];

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
      <div className="mb-8 pb-6" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="label mb-3">{t('serviceLabel')}</p>
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h1 className="text-3xl" style={{ color: 'var(--ink)', fontWeight: 300 }}>{t('pageTitle')}</h1>
          <Link
            href={`/${locale}/services/plate-solve`}
            className="text-sm transition-colors duration-150"
            style={{ color: 'var(--ink-faint)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}
          >
            ← {t('backToSolve')}
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Image */}
        <div>
          {result.has_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/plate-solve/image/${result.result_id}`}
              alt="Solved field"
              className="w-full"
              style={{ border: '1px solid var(--line)', display: 'block' }}
            />
          ) : (
            <div
              className="flex items-center justify-center text-sm"
              style={{ minHeight: 200, border: '1px solid var(--line)', color: 'var(--ink-faint)' }}
            >
              FITS — no preview
            </div>
          )}
        </div>

        {/* Metrics + actions */}
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--line)' }}>
            {metrics.map(({ label, value }) => (
              <div key={label} className="p-4" style={{ background: 'var(--bg)' }}>
                <p className="label mb-1">{label}</p>
                <p className="text-sm font-mono" style={{ color: 'var(--ink)' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button onClick={copyLink} className="btn w-full">
              {copied ? t('linkCopied') : t('copyLink')}
            </button>

            {result.has_wcs && (
              <a
                href={`/api/plate-solve/wcs/${result.result_id}`}
                download
                className="btn-outline w-full text-center"
              >
                {t('downloadWcs')}
              </a>
            )}
          </div>

          {/* Expiry */}
          <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
            {t('resultExpires')}: {formatExpiry(result.expires_at)}
          </p>
        </div>
      </div>
    </div>
  );
}
