'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';

interface SolveResult {
  success: boolean;
  result_id?: string;
  ra?: number;
  dec?: number;
  orientation?: number;
  pixscale?: number;
  parity?: string;
  radius?: number;
  width_deg?: number;
  height_deg?: number;
  has_image?: boolean;
  is_fits?: boolean;
  error?: string;
}

interface Props {
  isMember: boolean;
  isSignedIn: boolean;
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

export default function PlateSolveClient({ isMember, isSignedIn, locale }: Props) {
  const t = useTranslations('plateSolve');

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [ra, setRa] = useState('');
  const [dec, setDec] = useState('');
  const [radius, setRadius] = useState('');
  const [scaleLow, setScaleLow] = useState('');
  const [scaleHigh, setScaleHigh] = useState('');
  const [solving, setSolving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [solvedImageUrl, setSolvedImageUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setSolvedImageUrl(null);
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      const ext = f.name.toLowerCase();
      const isFits = ext.endsWith('.fits') || ext.endsWith('.fit');
      return !isFits ? URL.createObjectURL(f) : null;
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSolve = async () => {
    if (!file || solving) return;
    setSolving(true);
    setElapsed(0);
    setResult(null);
    setSolvedImageUrl(null);

    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 500);

    try {
      const form = new FormData();
      form.append('file', file);
      if (ra.trim() && dec.trim()) {
        form.append('ra', ra.trim());
        form.append('dec', dec.trim());
        if (radius.trim()) form.append('radius', radius.trim());
      }
      if (scaleLow.trim()) form.append('scale_low', scaleLow.trim());
      if (scaleHigh.trim()) form.append('scale_high', scaleHigh.trim());

      const res = await fetch('/api/plate-solve', { method: 'POST', body: form });
      const data: SolveResult = await res.json();
      setResult(data);

      if (data.success && data.has_image && data.result_id) {
        setSolvedImageUrl(`/api/plate-solve/image/${data.result_id}`);
      }
    } catch {
      setResult({ success: false, error: 'Network error' });
    } finally {
      setSolving(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  if (!isSignedIn) {
    return (
      <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
        <p className="label mb-3">{t('serviceLabel')}</p>
        <h1 className="text-3xl mb-10" style={{ color: 'var(--ink)', fontWeight: 300 }}>
          {t('pageTitle')}
        </h1>
        <div
          className="p-12 flex flex-col items-center gap-4 text-center"
          style={{ border: '1px solid var(--line)' }}
        >
          <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>
            {t('signInRequired')}
          </p>
          <button
            onClick={() => signIn('google', { callbackUrl: `/${locale}/services/plate-solve` })}
            className="btn"
          >
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
        <h1 className="text-3xl mb-10" style={{ color: 'var(--ink)', fontWeight: 300 }}>
          {t('pageTitle')}
        </h1>
        <div
          className="p-12 text-center"
          style={{ border: '1px solid var(--line)' }}
        >
          <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>{t('memberOnly')}</p>
        </div>
      </div>
    );
  }

  const errorMsg =
    result?.error === 'Solver timed out' ? t('errorTimeout') :
    result?.error === 'No solution found' ? t('errorNone') :
    result?.error === 'Server busy, try again later' ? t('errorBusy') :
    t('errorGeneric');

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
      <p className="label mb-3">{t('serviceLabel')}</p>
      <h1 className="text-3xl mb-2" style={{ color: 'var(--ink)', fontWeight: 300 }}>
        {t('pageTitle')}
      </h1>
      <p className="mb-10 text-sm" style={{ color: 'var(--ink-secondary)' }}>
        {t('description')}
      </p>

      <div className="grid md:grid-cols-2 gap-8 items-start">

        {/* ── Left: controls ── */}
        <div className="flex flex-col gap-6">

          {/* Drop zone */}
          <div>
            <p className="label mb-2">{t('uploadLabel')}</p>
            <div
              className="relative flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors duration-150"
              style={{
                border: `2px dashed ${dragOver ? 'var(--ink)' : 'var(--line)'}`,
                background: dragOver ? 'var(--bg-warm)' : 'transparent',
                minHeight: 160,
                padding: '2rem',
              }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.tiff,.tif,.fits,.fit"
                className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {file ? (
                <>
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="preview" style={{ maxHeight: 80, objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem', color: 'var(--ink-faint)' }}>☆</span>
                  )}
                  <div className="text-center">
                    <p className="text-sm" style={{ color: 'var(--ink)' }}>{file.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>{t('dropHere')}</p>
                  <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{t('uploadHint')}</p>
                </>
              )}
            </div>
          </div>

          {/* Hints */}
          <div>
            <button
              type="button"
              onClick={() => setShowHints(h => !h)}
              className="flex items-center gap-2 text-sm transition-colors duration-150"
              style={{ color: showHints ? 'var(--ink)' : 'var(--ink-faint)' }}
            >
              <span
                style={{
                  fontSize: '0.55rem',
                  display: 'inline-block',
                  transition: 'transform 0.15s',
                  transform: showHints ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >
                ▶
              </span>
              {t('hintLabel')}
            </button>

            {showHints && (
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{t('hintNote')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label mb-1 block">{t('ra')}</label>
                    <input
                      className="input"
                      placeholder={t('raPlaceholder')}
                      value={ra}
                      onChange={e => setRa(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block">{t('dec')}</label>
                    <input
                      className="input"
                      placeholder={t('decPlaceholder')}
                      value={dec}
                      onChange={e => setDec(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block">{t('radius')}</label>
                    <input
                      className="input"
                      placeholder={t('radiusPlaceholder')}
                      value={radius}
                      onChange={e => setRadius(e.target.value)}
                    />
                  </div>
                  <div />
                  <div>
                    <label className="label mb-1 block">{t('scaleLow')}</label>
                    <input
                      className="input"
                      placeholder="e.g. 1.5"
                      value={scaleLow}
                      onChange={e => setScaleLow(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block">{t('scaleHigh')}</label>
                    <input
                      className="input"
                      placeholder="e.g. 4.0"
                      value={scaleHigh}
                      onChange={e => setScaleHigh(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Solve button */}
          <button
            onClick={handleSolve}
            disabled={!file || solving}
            className="btn w-full"
            style={{ opacity: !file || solving ? 0.4 : 1, cursor: !file || solving ? 'not-allowed' : 'pointer' }}
          >
            {solving ? `${t('solving')} ${elapsed}s` : t('solve')}
          </button>
        </div>

        {/* ── Right: result ── */}
        <div>
          {!result && !solving && (
            <div
              className="flex items-center justify-center"
              style={{ minHeight: 200, border: '1px solid var(--line)' }}
            >
              <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{t('emptyState')}</p>
            </div>
          )}

          {solving && (
            <div
              className="flex flex-col items-center justify-center gap-3"
              style={{ minHeight: 200, border: '1px solid var(--line)' }}
            >
              <svg
                width="24" height="24" viewBox="0 0 24 24" fill="none"
                style={{ animation: 'spin 1s linear infinite' }}
              >
                <circle cx="12" cy="12" r="10" stroke="var(--line)" strokeWidth="2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>
                {t('solving')} {elapsed}s
              </p>
            </div>
          )}

          {result && result.success && (
            <div className="flex flex-col gap-4">
              {solvedImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={solvedImageUrl}
                  alt="Solved field"
                  className="w-full"
                  style={{ border: '1px solid var(--line)', display: 'block' }}
                />
              )}

              <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--line)' }}>
                {([
                  { label: t('raResult'),     value: raToHMS(result.ra ?? 0) },
                  { label: t('decResult'),    value: decToDMS(result.dec ?? 0) },
                  { label: t('pixscale'),     value: `${(result.pixscale ?? 0).toFixed(3)} ″/px` },
                  { label: t('fov'),          value: `${(result.width_deg ?? 0).toFixed(2)}° × ${(result.height_deg ?? 0).toFixed(2)}°` },
                  { label: t('orientation'),  value: `${(result.orientation ?? 0).toFixed(1)}° E of N` },
                  { label: t('parity'),       value: result.parity === 'pos' ? t('parityPos') : result.parity === 'neg' ? t('parityNeg') : '—' },
                ] as { label: string; value: string }[]).map(({ label, value }) => (
                  <div key={label} className="p-4" style={{ background: 'var(--bg)' }}>
                    <p className="label mb-1">{label}</p>
                    <p className="text-sm font-mono" style={{ color: 'var(--ink)' }}>{value}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-right" style={{ color: 'var(--ink-faint)' }}>
                {t('expiresNote')}
              </p>
            </div>
          )}

          {result && !result.success && (
            <div className="p-6" style={{ border: '1px solid var(--line)' }}>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--ink)' }}>
                {t('failed')}
              </p>
              <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>{errorMsg}</p>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
