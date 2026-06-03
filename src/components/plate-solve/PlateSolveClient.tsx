'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

interface Props {
  isMember: boolean;
  isSignedIn: boolean;
  locale: string;
}

type StageId =
  | 'uploading' | 'received' | 'preprocessing' | 'downsampling'
  | 'solving' | 'extracting' | 'matching'
  | 'done' | 'failed' | 'timeout' | 'error';

interface StageEntry {
  id: StageId;
  label: string;
  extra?: string;
}

// Order determines the visual progress list
const STAGE_ORDER: StageId[] = [
  'uploading', 'received', 'preprocessing', 'downsampling',
  'solving', 'extracting', 'matching', 'done',
];

type Phase = 'form' | 'progress' | 'failed';

export default function PlateSolveClient({ isMember, isSignedIn, locale }: Props) {
  const t = useTranslations('plateSolve');
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [ra, setRa] = useState('');
  const [dec, setDec] = useState('');
  const [radius, setRadius] = useState('');
  const [scaleLow, setScaleLow] = useState('');
  const [scaleHigh, setScaleHigh] = useState('');

  const [phase, setPhase] = useState<Phase>('form');
  const [stages, setStages] = useState<StageEntry[]>([]);
  const [activeStage, setActiveStage] = useState<StageId | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startTimer = () => {
    startRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 500);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPhase('form');
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

  const pushStage = (id: StageId, label: string, extra?: string) => {
    setStages(prev => {
      // avoid duplicates
      if (prev.some(s => s.id === id)) return prev;
      return [...prev, { id, label, extra }];
    });
    setActiveStage(id);
  };

  const handleSolve = async () => {
    if (!file) return;

    setPhase('progress');
    setStages([]);
    setActiveStage(null);
    setErrorMsg('');
    startTimer();

    pushStage('uploading', t('stageUploading'));

    const form = new FormData();
    form.append('file', file);
    if (ra.trim() && dec.trim()) {
      form.append('ra', ra.trim());
      form.append('dec', dec.trim());
      if (radius.trim()) form.append('radius', radius.trim());
    }
    if (scaleLow.trim()) form.append('scale_low', scaleLow.trim());
    if (scaleHigh.trim()) form.append('scale_high', scaleHigh.trim());

    let response: Response;
    try {
      response = await fetch('/api/plate-solve/stream', { method: 'POST', body: form });
    } catch {
      stopTimer();
      setErrorMsg(t('errorGeneric'));
      setPhase('failed');
      return;
    }

    if (!response.ok || !response.body) {
      stopTimer();
      setErrorMsg(t('errorGeneric'));
      setPhase('failed');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let data: Record<string, unknown>;
          try { data = JSON.parse(line.slice(6)); } catch { continue; }

          const stage = data.stage as string;

          switch (stage) {
            case 'received':
              pushStage('received', t('stageReceived'));
              break;
            case 'preprocessing':
              pushStage('preprocessing', t('stagePreprocessing'));
              break;
            case 'downsampling':
              pushStage('downsampling', t('stageDownsampling', { factor: Number(data.factor ?? 2) }));
              break;
            case 'solving':
              pushStage('solving', t('stageSolving'));
              break;
            case 'extracting':
              pushStage('extracting', t('stageExtracting'));
              break;
            case 'matching':
              pushStage('matching', t('stageMatching'));
              break;
            case 'done': {
              stopTimer();
              pushStage('done', t('stageDone'));
              const resultId = data.result_id as string;
              // Small delay so the "done" stage is visible before redirect
              setTimeout(() => {
                router.push(`/${locale}/services/plate-solve/${resultId}`);
              }, 600);
              return;
            }
            case 'failed':
              stopTimer();
              setErrorMsg(t('errorNone'));
              setPhase('failed');
              return;
            case 'timeout':
              stopTimer();
              setErrorMsg(t('errorTimeout'));
              setPhase('failed');
              return;
            case 'error':
              stopTimer();
              setErrorMsg((data.error as string) === 'Server busy, try again later'
                ? t('errorBusy')
                : t('errorGeneric'));
              setPhase('failed');
              return;
          }
        }
      }
    } catch {
      stopTimer();
      setErrorMsg(t('errorGeneric'));
      setPhase('failed');
    }
  };

  const reset = () => {
    setPhase('form');
    setStages([]);
    setActiveStage(null);
    setErrorMsg('');
    setElapsed(0);
    stopTimer();
  };

  // ── gate screens ──────────────────────────────────────────────────────────

  if (!isSignedIn) {
    return (
      <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
        <p className="label mb-3">{t('serviceLabel')}</p>
        <h1 className="text-3xl mb-10" style={{ color: 'var(--ink)', fontWeight: 300 }}>{t('pageTitle')}</h1>
        <div className="p-12 flex flex-col items-center gap-4 text-center" style={{ border: '1px solid var(--line)' }}>
          <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>{t('signInRequired')}</p>
          <button onClick={() => signIn('google', { callbackUrl: `/${locale}/services/plate-solve` })} className="btn">
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

  // ── progress screen ───────────────────────────────────────────────────────

  if (phase === 'progress' || phase === 'failed') {
    const isError = phase === 'failed';

    return (
      <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
        <p className="label mb-3">{t('serviceLabel')}</p>
        <h1 className="text-3xl mb-10" style={{ color: 'var(--ink)', fontWeight: 300 }}>{t('pageTitle')}</h1>

        <div className="max-w-sm mx-auto">
          <div className="flex flex-col gap-3 mb-8">
            {stages.map((s) => {
              const isActive = s.id === activeStage && !isError;
              const isDone = !isActive && STAGE_ORDER.indexOf(s.id) <= STAGE_ORDER.indexOf(activeStage ?? 'uploading');
              return (
                <div key={s.id} className="flex items-center gap-3">
                  {/* Icon */}
                  <div style={{ width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isActive ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="8" cy="8" r="6" stroke="var(--line-dark)" strokeWidth="2" />
                        <path d="M8 2a6 6 0 0 1 6 6" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6" stroke="var(--ink-faint)" strokeWidth="1.5" />
                        <path d="M4 7l2 2 4-4" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  {/* Label */}
                  <span className="text-sm" style={{ color: isActive ? 'var(--ink)' : 'var(--ink-secondary)' }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {!isError && (
            <p className="text-xs text-center" style={{ color: 'var(--ink-faint)' }}>
              {t('elapsed', { s: elapsed })}
            </p>
          )}

          {isError && (
            <div className="mt-2">
              <p className="text-sm mb-6" style={{ color: 'var(--ink-secondary)' }}>{errorMsg}</p>
              <button onClick={reset} className="btn w-full">{t('tryAgain')}</button>
            </div>
          )}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── form screen ───────────────────────────────────────────────────────────

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
      <p className="label mb-3">{t('serviceLabel')}</p>
      <h1 className="text-3xl mb-2" style={{ color: 'var(--ink)', fontWeight: 300 }}>{t('pageTitle')}</h1>
      <p className="mb-10 text-sm" style={{ color: 'var(--ink-secondary)' }}>{t('description')}</p>

      <div className="max-w-lg flex flex-col gap-6">

        {/* Drop zone */}
        <div>
          <p className="label mb-2">{t('uploadLabel')}</p>
          <div
            className="flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors duration-150"
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
                {previewUrl
                  ? <img src={previewUrl} alt="preview" style={{ maxHeight: 80, objectFit: 'contain' }} /> // eslint-disable-line @next/next/no-img-element
                  : <span style={{ fontSize: '1.5rem', color: 'var(--ink-faint)' }}>☆</span>}
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

        {/* Hints toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowHints(h => !h)}
            className="flex items-center gap-2 text-sm transition-colors duration-150"
            style={{ color: showHints ? 'var(--ink)' : 'var(--ink-faint)' }}
          >
            <span style={{ fontSize: '0.55rem', display: 'inline-block', transition: 'transform 0.15s', transform: showHints ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            {t('hintLabel')}
          </button>

          {showHints && (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{t('hintNote')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1 block">{t('ra')}</label>
                  <input className="input" placeholder={t('raPlaceholder')} value={ra} onChange={e => setRa(e.target.value)} />
                </div>
                <div>
                  <label className="label mb-1 block">{t('dec')}</label>
                  <input className="input" placeholder={t('decPlaceholder')} value={dec} onChange={e => setDec(e.target.value)} />
                </div>
                <div>
                  <label className="label mb-1 block">{t('radius')}</label>
                  <input className="input" placeholder={t('radiusPlaceholder')} value={radius} onChange={e => setRadius(e.target.value)} />
                </div>
                <div />
                <div>
                  <label className="label mb-1 block">{t('scaleLow')}</label>
                  <input className="input" placeholder="e.g. 1.5" value={scaleLow} onChange={e => setScaleLow(e.target.value)} />
                </div>
                <div>
                  <label className="label mb-1 block">{t('scaleHigh')}</label>
                  <input className="input" placeholder="e.g. 4.0" value={scaleHigh} onChange={e => setScaleHigh(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Solve button */}
        <button
          onClick={handleSolve}
          disabled={!file}
          className="btn"
          style={{ opacity: !file ? 0.4 : 1, cursor: !file ? 'not-allowed' : 'pointer' }}
        >
          {t('solve')}
        </button>
      </div>
    </div>
  );
}
