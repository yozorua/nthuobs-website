import { useTranslations } from 'next-intl';
import { WeatherReading } from './types';

// ── Moon age calculation (no external dependency) ────────────────────────────
// Reference new moon: 2000-01-06 18:14 UTC  (J2000)
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const LUNAR_PERIOD_MS   = 29.530589 * 24 * 60 * 60 * 1000;

function moonPhaseNow(): number {
  // Returns 0 (new) → 0.5 (full) → 1 (new again)
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
  // Fraction lit: 0 → 1 → 0
  return Math.round(50 * (1 - Math.cos(phase * 2 * Math.PI)));
}

// ── Moon phase SVG ───────────────────────────────────────────────────────────
// Renders an accurate moon phase using arc paths.
// phase: 0 = new moon, 0.5 = full moon, 1 = new moon again
function MoonPhaseSVG({ phase, size = 52 }: { phase: number; size?: number }) {
  const r = size / 2;
  const isNew  = phase < 0.02 || phase > 0.98;
  const isFull = phase > 0.48 && phase < 0.52;

  let shadowPath: string | null = null;

  if (!isNew && !isFull) {
    const waxing = phase < 0.5;
    if (waxing) {
      // termX: r at new → 0 at quarter → -r at full
      const termX = r * Math.cos(phase * 2 * Math.PI);
      // sweep=1 → clockwise terminator (crescent); sweep=0 → counterclockwise (gibbous)
      const s = termX > 0 ? 1 : 0;
      shadowPath = `M ${r} 0 A ${r} ${r} 0 0 0 ${r} ${size} A ${Math.abs(termX)} ${r} 0 0 ${s} ${r} 0 Z`;
    } else {
      // normTermX: r at full → 0 at last quarter → -r at new
      const normTermX = r * Math.cos((phase - 0.5) * 2 * Math.PI);
      const s = normTermX > 0 ? 0 : 1;
      shadowPath = `M ${r} 0 A ${r} ${r} 0 0 1 ${r} ${size} A ${Math.abs(normTermX)} ${r} 0 0 ${s} ${r} 0 Z`;
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {/* Moon surface */}
      <circle
        cx={r} cy={r} r={r - 0.5}
        fill={isNew ? 'rgba(30,40,80,0.60)' : 'rgba(255,248,200,0.92)'}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.5"
      />
      {/* Shadow overlay */}
      {shadowPath && (
        <path d={shadowPath} fill="rgba(20,30,65,0.82)" />
      )}
    </svg>
  );
}

// ── Day timeline bar ─────────────────────────────────────────────────────────
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

// ── Component ────────────────────────────────────────────────────────────────
export default function SunMoonCard({ reading }: { reading: WeatherReading | null }) {
  const t = useTranslations('weather');
  const phase = moonPhaseNow();
  const illum = moonIllumination(phase);
  const phaseName = moonPhaseName(phase);

  return (
    <div className="card p-5">
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

      {/* Sun times */}
      <div className="flex justify-between text-xs mb-1">
        <span>
          <span style={{ color: 'var(--ink-faint)' }}>☀ Rise </span>
          <span style={{ color: 'var(--ink)' }}>{reading?.sunrise ?? '—'}</span>
        </span>
        <span>
          <span style={{ color: 'var(--ink-faint)' }}>Set </span>
          <span style={{ color: 'var(--ink)' }}>{reading?.sunset ?? '—'}</span>
        </span>
      </div>
      <TimelineBar sunrise={reading?.sunrise} sunset={reading?.sunset} />
    </div>
  );
}
