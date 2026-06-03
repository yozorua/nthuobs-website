'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

interface Props {
  isMember: boolean;
  isSignedIn: boolean;
  locale: string;
}

interface RecentResult {
  result_id: string;
  status: 'solving' | 'done';
  ra: number;
  dec: number;
  pixscale: number;
  width_deg: number;
  height_deg: number;
  solved_at: number;   // start time when solving; solve time when done
  expires_at: number;
}

type StageId =
  | 'uploading' | 'received' | 'preprocessing' | 'downsampling'
  | 'solving' | 'extracting' | 'matching'
  | 'done' | 'failed' | 'timeout' | 'error';

interface StageEntry { id: StageId; label: string; }

type Phase = 'form' | 'progress' | 'failed';

const LS_KEY = 'nthuobs_plate_solve_history';
const POLL_INTERVAL = 5000; // ms
const PENDING_TTL = 86400;  // seconds — match server result TTL (24 h); poll cleans up failed entries

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

function formatFov(wDeg: number, hDeg: number): string {
  const larger = Math.max(wDeg, hDeg);
  if (larger >= 1)
    return `${wDeg.toFixed(2)}°×${hDeg.toFixed(2)}°`;
  if (larger >= 1 / 60)
    return `${(wDeg * 60).toFixed(1)}′×${(hDeg * 60).toFixed(1)}′`;
  return `${(wDeg * 3600).toFixed(0)}″×${(hDeg * 3600).toFixed(0)}″`;
}

/** Parse "hh mm ss.s" / "hh:mm:ss" / "12h34m56.7s" → decimal degrees, or null */
function parseHMS(raw: string): number | null {
  const s = raw.replace(/[hmsdHMS°'"]/g, ' ').replace(/[:\s]+/g, ' ').trim();
  const parts = s.split(' ').filter(Boolean);
  if (parts.length === 0 || parts.length > 3) return null;
  const h = parseFloat(parts[0]);
  const m = parseFloat(parts[1] ?? '0');
  const sec = parseFloat(parts[2] ?? '0');
  if ([h, m, sec].some(isNaN)) return null;
  if (h < 0 || h >= 24 || m < 0 || m >= 60 || sec < 0 || sec >= 60) return null;
  return (h + m / 60 + sec / 3600) * 15;
}

/** Parse "±dd mm ss.s" / "±dd:mm:ss" / "+12°34'56\"" → decimal degrees, or null */
function parseDMS(raw: string): number | null {
  const sign = raw.trimStart().startsWith('-') ? -1 : 1;
  const s = raw.replace(/[+\-dmsDMS°'"]/g, ' ').replace(/[:\s]+/g, ' ').trim();
  const parts = s.split(' ').filter(Boolean);
  if (parts.length === 0 || parts.length > 3) return null;
  const d = parseFloat(parts[0]);
  const m = parseFloat(parts[1] ?? '0');
  const sec = parseFloat(parts[2] ?? '0');
  if ([d, m, sec].some(isNaN)) return null;
  if (d < 0 || d > 90 || m < 0 || m >= 60 || sec < 0 || sec >= 60) return null;
  const val = sign * (d + m / 60 + sec / 3600);
  if (val < -90 || val > 90) return null;
  return val;
}

type TFn = (key: string, values?: Record<string, string | number>) => string;

function timeAgo(ts: number, t: TFn): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return t('timeJustNow');
  if (diff < 3600) return t('timeMinAgo', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('timeHrAgo', { n: Math.floor(diff / 3600) });
  return t('timeDayAgo', { n: Math.floor(diff / 86400) });
}

// ── localStorage helpers ───────────────────────────────────────────────────

function loadRecent(): RecentResult[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const now = Date.now() / 1000;
    return (JSON.parse(raw) as RecentResult[])
      .map(r => ({ ...r, status: r.status ?? 'done' }))
      .filter(r => {
        if (r.status === 'solving') return now - r.solved_at < PENDING_TTL;
        return r.expires_at > now;
      });
  } catch { return []; }
}

function _persist(entries: RecentResult[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(entries.slice(0, 10))); } catch {}
}

function savePending(entry: RecentResult): RecentResult[] {
  const list = [entry, ...loadRecent().filter(r => r.result_id !== entry.result_id)];
  _persist(list);
  return list;
}

function saveRecent(entry: RecentResult): RecentResult[] {
  const list = [entry, ...loadRecent().filter(r => r.result_id !== entry.result_id)];
  _persist(list);
  return list;
}

function updateRecentEntry(result_id: string, updates: Partial<RecentResult>): void {
  const list = loadRecent().map(r => r.result_id === result_id ? { ...r, ...updates } : r);
  _persist(list);
}

function removeRecentEntry(result_id: string): void {
  _persist(loadRecent().filter(r => r.result_id !== result_id));
}

// ── component ─────────────────────────────────────────────────────────────

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
  const [downsample, setDownsample] = useState('2');
  const [objs, setObjs] = useState('50');

  const [phase, setPhase] = useState<Phase>('form');
  const [stages, setStages] = useState<StageEntry[]>([]);
  const [activeStage, setActiveStage] = useState<StageId | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [recent, setRecent] = useState<RecentResult[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const currentJobIdRef = useRef<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  // Load recent results; silently re-fetch all done entries to overwrite stale cached values
  useEffect(() => {
    const entries = loadRecent();
    setRecent(entries);

    const done = entries.filter(r => r.status === 'done');
    if (done.length > 0) {
      Promise.all(done.map(async r => {
        try {
          const res = await fetch(`/api/plate-solve/result/${r.result_id}`);
          if (!res.ok) return null;
          const d = await res.json();
          if (!d.success) return null;
          return { ...r, ra: d.ra, dec: d.dec, pixscale: d.pixscale,
            width_deg: d.width_deg, height_deg: d.height_deg,
            solved_at: d.solved_at, expires_at: d.expires_at } as RecentResult;
        } catch { return null; }
      })).then(refreshed => {
        const valid = refreshed.filter(Boolean) as RecentResult[];
        if (valid.length === 0) return;
        const updated = loadRecent().map(r =>
          valid.find(v => v.result_id === r.result_id) ?? r
        );
        _persist(updated);
        setRecent(updated);
      });
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const hasPending = recent.some(r => r.status === 'solving');
    if (!hasPending) return;

    const poll = async () => {
      const now = Date.now() / 1000;
      let changed = false;
      for (const entry of loadRecent().filter(r => r.status === 'solving')) {
        // Skip very recent entries — backend may not have created pending.json yet
        if (now - entry.solved_at < 20) continue;
        try {
          const res = await fetch(`/api/plate-solve/status/${entry.result_id}`);
          if (!res.ok) continue;
          const { status } = await res.json() as { status: string };

          if (status === 'done') {
            const rr = await fetch(`/api/plate-solve/result/${entry.result_id}`);
            if (rr.ok) {
              const data = await rr.json();
              if (data.success) {
                saveRecent({
                  result_id: entry.result_id,
                  status: 'done',
                  ra: data.ra, dec: data.dec,
                  pixscale: data.pixscale,
                  width_deg: data.width_deg, height_deg: data.height_deg,
                  solved_at: data.solved_at, expires_at: data.expires_at,
                });
                changed = true;
              }
            }
          } else if (status === 'not_found' || status === 'expired') {
            removeRecentEntry(entry.result_id);
            changed = true;
          }
        } catch {}
      }
      if (changed) setRecent(loadRecent());
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [recent.some(r => r.status === 'solving')]); // re-register when pending count changes

  const startTimer = () => {
    startRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
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
      const noInlineBrowser = ['.fits', '.fit', '.tiff', '.tif'].some(s => ext.endsWith(s));
      return noInlineBrowser ? null : URL.createObjectURL(f);
    });
  }, []);

  const pushStage = (id: StageId, label: string) =>
    setStages(prev => prev.some(s => s.id === id) ? prev : [...prev, { id, label }]);

  const handleSolve = async () => {
    if (!file) return;
    setPhase('progress');
    setStages([]);
    setActiveStage(null);
    setErrorMsg('');
    startTimer();
    pushStage('uploading', t('stageUploading'));
    setActiveStage('uploading');

    const form = new FormData();
    form.append('file', file);
    if (ra.trim() && dec.trim()) {
      const raDeg = parseHMS(ra.trim());
      const decDeg = parseDMS(dec.trim());
      if (raDeg !== null && decDeg !== null) {
        form.append('ra', String(raDeg));
        form.append('dec', String(decDeg));
        if (radius.trim()) form.append('radius', radius.trim());
      }
    }
    if (scaleLow.trim()) form.append('scale_low', scaleLow.trim());
    if (scaleHigh.trim()) form.append('scale_high', scaleHigh.trim());
    if (downsample.trim()) form.append('downsample', downsample.trim());
    if (objs.trim()) form.append('objs', objs.trim());

    streamAbortRef.current = new AbortController();
    let response: Response;
    try {
      response = await fetch('/api/plate-solve/stream', { method: 'POST', body: form, signal: streamAbortRef.current.signal });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      stopTimer(); setErrorMsg(t('errorGeneric')); setPhase('failed'); return;
    }

    if (!response.ok || !response.body) {
      stopTimer(); setErrorMsg(t('errorGeneric')); setPhase('failed'); return;
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

          if (stage === 'started') {
            // Save pending entry immediately — user can navigate away now
            const rid = data.result_id as string;
            currentJobIdRef.current = rid;
            setCurrentJobId(rid);
            const nowTs = Date.now() / 1000;
            const pending: RecentResult = {
              result_id: rid, status: 'solving',
              ra: 0, dec: 0, pixscale: 0, width_deg: 0, height_deg: 0,
              solved_at: nowTs, expires_at: nowTs + PENDING_TTL,
            };
            setRecent(savePending(pending));
            continue;
          }

          const stageMap: Partial<Record<string, [StageId, string]>> = {
            received:     ['received',      t('stageReceived')],
            preprocessing:['preprocessing', t('stagePreprocessing')],
            downsampling: ['downsampling',  t('stageDownsampling', { factor: Number(data.factor ?? 2) })],
            solving:      ['solving',       t('stageSolving')],
            extracting:   ['extracting',    t('stageExtracting')],
            matching:     ['matching',      t('stageMatching')],
          };

          if (stageMap[stage]) {
            const [id, label] = stageMap[stage]!;
            pushStage(id, label);
            setActiveStage(id);
          } else if (stage === 'done') {
            stopTimer();
            pushStage('done', t('stageDone'));
            setActiveStage('done');
            const rid = data.result_id as string;
            const entry: RecentResult = {
              result_id: rid, status: 'done',
              ra: data.ra as number, dec: data.dec as number,
              pixscale: data.pixscale as number,
              width_deg: data.width_deg as number, height_deg: data.height_deg as number,
              solved_at: data.solved_at as number, expires_at: data.expires_at as number,
            };
            setRecent(saveRecent(entry));
            setTimeout(() => router.push(`/${locale}/services/plate-solve/${rid}`), 700);
            return;
          } else if (stage === 'failed') {
            if (currentJobIdRef.current) { removeRecentEntry(currentJobIdRef.current); setRecent(loadRecent()); }
            stopTimer(); setErrorMsg(t('errorNone')); setPhase('failed'); return;
          } else if (stage === 'timeout') {
            if (currentJobIdRef.current) { removeRecentEntry(currentJobIdRef.current); setRecent(loadRecent()); }
            stopTimer(); setErrorMsg(t('errorTimeout')); setPhase('failed'); return;
          } else if (stage === 'error') {
            if (currentJobIdRef.current) { removeRecentEntry(currentJobIdRef.current); setRecent(loadRecent()); }
            stopTimer();
            const msg = data.error as string;
            setErrorMsg(msg === 'Server busy, try again later' ? t('errorBusy') : t('errorGeneric'));
            setPhase('failed'); return;
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      stopTimer(); setErrorMsg(t('errorGeneric')); setPhase('failed');
    }
  };

  const reset = () => {
    currentJobIdRef.current = null;
    setCurrentJobId(null);
    setPhase('form'); setStages([]); setActiveStage(null);
    setErrorMsg(''); setElapsed(0); stopTimer();
  };

  // ── gates ─────────────────────────────────────────────────────────────────

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

  // ── shared: recent solves table ───────────────────────────────────────────

  const recentTable = recent.length > 0 ? (
    <div className="mt-16 pt-8" style={{ borderTop: '1px solid var(--line)' }}>
      <p className="label mb-4">{t('recentLabel')}</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              {[t('recentId'), t('recentRa'), t('recentDec'), t('recentScale'), t('recentFov'), t('recentTime'), ''].map((h, i) => (
                <th key={i} className="label pb-2 text-left" style={{ paddingRight: '1.5rem', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map(r => (
              <tr key={r.result_id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td className="py-3 font-mono text-xs" style={{ paddingRight: '1.5rem', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{r.result_id.slice(0, 8)}</td>
                {r.status === 'solving' ? (
                  <>
                    <td colSpan={4} className="py-3 text-xs" style={{ paddingRight: '1.5rem', color: 'var(--ink-faint)' }}>
                      <span className="flex items-center gap-2">
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                          <circle cx="5.5" cy="5.5" r="4.5" stroke="var(--line-dark)" strokeWidth="1.5" />
                          <path d="M5.5 1a4.5 4.5 0 0 1 4.5 4.5" stroke="var(--ink-faint)" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        {t('solving')}
                      </span>
                    </td>
                    <td className="py-3 text-xs" style={{ paddingRight: '1.5rem', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{timeAgo(r.solved_at, t)}</td>
                    <td className="py-3 text-xs text-right" style={{ color: 'var(--ink-faint)' }}>—</td>
                  </>
                ) : (
                  <>
                    <td className="py-3 font-mono text-xs" style={{ paddingRight: '1.5rem', color: 'var(--ink)', whiteSpace: 'nowrap' }}>{raToHMS(r.ra)}</td>
                    <td className="py-3 font-mono text-xs" style={{ paddingRight: '1.5rem', color: 'var(--ink)', whiteSpace: 'nowrap' }}>{decToDMS(r.dec)}</td>
                    <td className="py-3 font-mono text-xs" style={{ paddingRight: '1.5rem', color: 'var(--ink-secondary)', whiteSpace: 'nowrap' }}>{r.pixscale.toFixed(2)}″/px</td>
                    <td className="py-3 font-mono text-xs" style={{ paddingRight: '1.5rem', color: 'var(--ink-secondary)', whiteSpace: 'nowrap' }}>{formatFov(r.width_deg, r.height_deg)}</td>
                    <td className="py-3 text-xs" style={{ paddingRight: '1.5rem', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{timeAgo(r.solved_at, t)}</td>
                    <td className="py-3 text-xs text-right">
                      <Link href={`/${locale}/services/plate-solve/${r.result_id}`} className="hover-faint" style={{ letterSpacing: '0.05em' }}>→</Link>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ) : null;

  // ── progress / failed ─────────────────────────────────────────────────────

  if (phase === 'progress' || phase === 'failed') {
    const isError = phase === 'failed';
    return (
      <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
        <p className="label mb-3">{t('serviceLabel')}</p>
        <h1 className="text-3xl mb-10" style={{ color: 'var(--ink)', fontWeight: 300 }}>{t('pageTitle')}</h1>

        <div className="flex flex-col items-center">
          <div className="flex flex-col items-start gap-3 mb-6">
            {stages.map((s) => {
              const isActive = s.id === activeStage && !isError;
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <div style={{ width: 18, height: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  <span className="text-sm" style={{ color: isActive ? 'var(--ink)' : 'var(--ink-secondary)' }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {!isError && (
            <>
              <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                {t('elapsed', { s: elapsed })}
              </p>
              {currentJobId && (
                <p className="text-xs mt-2 font-mono" style={{ color: 'var(--ink-faint)' }}>
                  {currentJobId.slice(0, 8)}
                </p>
              )}
              {stages.some(s => s.id === 'received') && (
                <p className="text-xs mt-3" style={{ color: 'var(--ink-faint)' }}>
                  {t('leavePageHint')}
                </p>
              )}
            </>
          )}
          {isError && (
            <div className="mt-2 text-center max-w-xs">
              <p className="text-sm mb-6" style={{ color: 'var(--ink-secondary)' }}>{errorMsg}</p>
              <button onClick={reset} className="btn">{t('tryAgain')}</button>
            </div>
          )}
        </div>

        {recentTable}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── form ──────────────────────────────────────────────────────────────────

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
      <p className="label mb-3">{t('serviceLabel')}</p>
      <h1 className="text-3xl mb-2" style={{ color: 'var(--ink)', fontWeight: 300 }}>{t('pageTitle')}</h1>
      <p className="mb-10 text-sm" style={{ color: 'var(--ink-secondary)' }}>{t('description')}</p>

      <div className="max-w-lg mx-auto flex flex-col gap-6">

        {/* Drop zone */}
        <div>
          <p className="label mb-2">{t('uploadLabel')}</p>
          <div
            className="flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors duration-150"
            style={{
              border: `2px dashed ${dragOver ? 'var(--ink)' : 'var(--line)'}`,
              background: dragOver ? 'var(--bg-warm)' : 'transparent',
              minHeight: 160, padding: '2rem',
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
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
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={previewUrl} alt="preview" style={{ maxHeight: 80, objectFit: 'contain' }} />
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

        {/* Hints */}
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
                <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-secondary)' }}>{t('ra')}</label><input className="input" placeholder={t('raPlaceholder')} value={ra} onChange={e => setRa(e.target.value)} /></div>
                <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-secondary)' }}>{t('dec')}</label><input className="input" placeholder={t('decPlaceholder')} value={dec} onChange={e => setDec(e.target.value)} /></div>
                <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-secondary)' }}>{t('radius')}</label><input className="input" placeholder={t('radiusPlaceholder')} value={radius} onChange={e => setRadius(e.target.value)} /></div>
                <div />
                <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-secondary)' }}>{t('scaleLow')}</label><input className="input" placeholder="e.g. 1.5" value={scaleLow} onChange={e => setScaleLow(e.target.value)} /></div>
                <div><label className="text-xs block mb-1" style={{ color: 'var(--ink-secondary)' }}>{t('scaleHigh')}</label><input className="input" placeholder="e.g. 4.0" value={scaleHigh} onChange={e => setScaleHigh(e.target.value)} /></div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--ink-secondary)' }}>{t('downsampleField')}</label>
                  <input className="input" placeholder="1–8" value={downsample} onChange={e => setDownsample(e.target.value)} />
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>{t('downsampleNote')}</p>
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--ink-secondary)' }}>{t('objsField')}</label>
                  <input className="input" placeholder="10–500" value={objs} onChange={e => setObjs(e.target.value)} />
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>{t('objsNote')}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSolve}
          disabled={!file}
          className="btn"
          style={{ opacity: !file ? 0.4 : 1, cursor: !file ? 'not-allowed' : 'pointer' }}
        >
          {t('solve')}
        </button>
      </div>

      {recentTable}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
