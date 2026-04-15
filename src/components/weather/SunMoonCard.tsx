import { useTranslations } from 'next-intl';
import { WeatherReading } from './types';

// ── Moon phase helpers ────────────────────────────────────────────────────────
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const LUNAR_PERIOD_MS   = 29.530589 * 24 * 60 * 60 * 1000;

function moonPhaseNow(): number {
  const elapsed = Date.now() - KNOWN_NEW_MOON_MS;
  return ((elapsed % LUNAR_PERIOD_MS) + LUNAR_PERIOD_MS) % LUNAR_PERIOD_MS / LUNAR_PERIOD_MS;
}

function moonPhaseName(phase: number): string {
  const names = [
    'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
    'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
  ];
  return names[Math.round(phase * 8) % 8];
}

function moonIllumination(phase: number): number {
  return Math.round(50 * (1 - Math.cos(phase * 2 * Math.PI)));
}

// ── Moon phase SVG ────────────────────────────────────────────────────────────
function MoonPhaseSVG({ phase, size = 52 }: { phase: number; size?: number }) {
  const r = size / 2;
  const isNew  = phase < 0.02 || phase > 0.98;
  const isFull = phase > 0.48 && phase < 0.52;
  let shadowPath: string | null = null;

  if (!isNew && !isFull) {
    const waxing = phase < 0.5;
    if (waxing) {
      const termX = r * Math.cos(phase * 2 * Math.PI);
      const s = termX > 0 ? 1 : 0;
      shadowPath = `M ${r} 0 A ${r} ${r} 0 0 0 ${r} ${size} A ${Math.abs(termX)} ${r} 0 0 ${s} ${r} 0 Z`;
    } else {
      const normTermX = r * Math.cos((phase - 0.5) * 2 * Math.PI);
      const s = normTermX > 0 ? 0 : 1;
      shadowPath = `M ${r} 0 A ${r} ${r} 0 0 1 ${r} ${size} A ${Math.abs(normTermX)} ${r} 0 0 ${s} ${r} 0 Z`;
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={r} cy={r} r={r - 0.5}
        fill={isNew ? 'rgba(30,40,80,0.60)' : 'rgba(255,248,200,0.92)'}
        stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
      {shadowPath && <path d={shadowPath} fill="rgba(20,30,65,0.82)" />}
    </svg>
  );
}

// ── Sunrise / Sunset icons ────────────────────────────────────────────────────
// 22×18 viewBox: horizon at y=12, sun arc above, direction arrow below
function SunHorizonIcon({ dir }: { dir: 'rise' | 'set' }) {
  const st = { stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" style={{ flexShrink: 0, opacity: 0.75 }}>
      {/* Horizon line */}
      <line x1="1" y1="12" x2="21" y2="12" {...st} />
      {/* Upper half of sun arc */}
      <path d="M 4.5 12 A 6.5 6.5 0 0 1 17.5 12" {...st} />
      {/* Sun rays */}
      <line x1="11" y1="2" x2="11" y2="4"   {...st} />
      <line x1="16.5" y1="4.5" x2="15.2" y2="5.8" {...st} />
      <line x1="5.5"  y1="4.5" x2="6.8"  y2="5.8" {...st} />
      {/* Directional arrow */}
      {dir === 'rise' ? (
        // Arrow pointing up (↑)
        <polyline points="8,17 11,13.5 14,17" {...st} strokeLinejoin="round" />
      ) : (
        // Arrow pointing down (↓)
        <polyline points="8,13.5 11,17 14,13.5" {...st} strokeLinejoin="round" />
      )}
    </svg>
  );
}

// ── Day timeline bar ──────────────────────────────────────────────────────────
function TimelineBar({ sunrise, sunset }: { sunrise?: string | null; sunset?: string | null }) {
  if (!sunrise || !sunset) return null;
  const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0); };
  const now  = new Date().getHours() * 60 + new Date().getMinutes();
  const rise = toMin(sunrise), set = toMin(sunset), total = 24 * 60;
  return (
    <div className="relative h-1.5 rounded-full mt-3" style={{ background: 'rgba(255,255,255,0.10)' }}>
      <div className="absolute top-0 h-full rounded-full"
           style={{ left: `${rise/total*100}%`, width: `${(set-rise)/total*100}%`, background: 'rgba(255,220,80,0.55)' }} />
      <div className="absolute top-1/2 w-2 h-2 rounded-full -translate-y-1/2 -translate-x-1/2"
           style={{ left: `${now/total*100}%`, background: 'rgba(255,255,255,0.90)', boxShadow: '0 0 4px rgba(255,255,255,0.6)' }} />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SunMoonCard({ reading }: { reading: WeatherReading | null }) {
  const t = useTranslations('weather');
  const phase = moonPhaseNow();
  const illum = moonIllumination(phase);
  const phaseName = moonPhaseName(phase);

  return (
    <div className="card p-5 h-full">
      <p className="label mb-4">{t('sunMoon')}</p>

      {/* Moon phase row */}
      <div className="flex items-center gap-4 mb-4">
        <MoonPhaseSVG phase={phase} size={52} />
        <div>
          <div className="text-sm font-light" style={{ color: 'var(--ink)' }}>{phaseName}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>
            {illum}% illuminated
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
            ↑ {reading?.moonrise ?? '—'} &nbsp;↓ {reading?.moonset ?? '—'}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginBottom: '0.75rem' }} />

      {/* Sun times with icons */}
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1.5">
          <SunHorizonIcon dir="rise" />
          <span style={{ color: 'var(--ink)' }}>{reading?.sunrise ?? '—'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <SunHorizonIcon dir="set" />
          <span style={{ color: 'var(--ink)' }}>{reading?.sunset ?? '—'}</span>
        </span>
      </div>

      <TimelineBar sunrise={reading?.sunrise} sunset={reading?.sunset} />
    </div>
  );
}
