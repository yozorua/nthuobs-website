import { useTranslations } from 'next-intl';
import { WeatherReading } from './types';

// ── Moon phase helpers ────────────────────────────────────────────────────────
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const LUNAR_PERIOD_MS   = 29.530589 * 24 * 60 * 60 * 1000;

function moonPhaseNow(): number {
  const elapsed = Date.now() - KNOWN_NEW_MOON_MS;
  return ((elapsed % LUNAR_PERIOD_MS) + LUNAR_PERIOD_MS) % LUNAR_PERIOD_MS / LUNAR_PERIOD_MS;
}

type MoonPhaseKey = 'NewMoon' | 'WaxingCrescent' | 'FirstQuarter' | 'WaxingGibbous' | 'FullMoon' | 'WaningGibbous' | 'LastQuarter' | 'WaningCrescent';

function moonPhaseKey(phase: number): MoonPhaseKey {
  const keys: MoonPhaseKey[] = [
    'NewMoon', 'WaxingCrescent', 'FirstQuarter', 'WaxingGibbous',
    'FullMoon', 'WaningGibbous', 'LastQuarter', 'WaningCrescent',
  ];
  return keys[Math.round(phase * 8) % 8]!;
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
      // In SVG Y-down space: sweep=0 (CCW) from bottom goes RIGHT, sweep=1 (CW) goes LEFT.
      // Crescent (termX > 0): add a right-side cap to the shadow → sweep=0
      // Gibbous  (termX < 0): add a left-side cap to subtract from shadow → sweep=1
      const s = termX > 0 ? 0 : 1;
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

// ── Horizon icons ─────────────────────────────────────────────────────────────
// 22×18 viewBox: horizon at y=12, body above, direction arrow below
function SunHorizonIcon({ dir }: { dir: 'rise' | 'set' }) {
  const st = { stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" style={{ flexShrink: 0, opacity: 0.75 }}>
      <line x1="1" y1="12" x2="21" y2="12" {...st} />
      <path d="M 4.5 12 A 6.5 6.5 0 0 1 17.5 12" {...st} />
      <line x1="11" y1="2" x2="11" y2="4"   {...st} />
      <line x1="16.5" y1="4.5" x2="15.2" y2="5.8" {...st} />
      <line x1="5.5"  y1="4.5" x2="6.8"  y2="5.8" {...st} />
      {dir === 'rise' ? (
        <polyline points="8,17 11,13.5 14,17" {...st} strokeLinejoin="round" />
      ) : (
        <polyline points="8,13.5 11,17 14,13.5" {...st} strokeLinejoin="round" />
      )}
    </svg>
  );
}

// Crescent moon + horizon icon (two overlapping circles = crescent)
function MoonHorizonIcon({ dir }: { dir: 'rise' | 'set' }) {
  const st = { stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" style={{ flexShrink: 0, opacity: 0.65 }}>
      <line x1="1" y1="12" x2="21" y2="12" {...st} />
      {/* crescent: lit disc minus slightly offset shadow disc */}
      <circle cx="11" cy="7" r="3.6" fill="rgba(255,248,200,0.80)" />
      <circle cx="12.4" cy="6.2" r="2.9" fill="rgba(20,15,50,0.92)" />
      {dir === 'rise' ? (
        <polyline points="8,17 11,13.5 14,17" {...st} strokeLinejoin="round" />
      ) : (
        <polyline points="8,13.5 11,17 14,13.5" {...st} strokeLinejoin="round" />
      )}
    </svg>
  );
}

// ── Day/twilight/night timeline bar ───────────────────────────────────────────
// Shows (from left to right):
//   night → astro twilight → nautical → civil → day → civil → nautical → astro → night
// Approximate offsets for ~25 °N (Taiwan):
//   Astronomical twilight boundary : ±90 min from sunrise/sunset
//   Nautical                        : ±62 min
//   Civil                           : ±30 min
function TimelineBar({
  sunrise, sunset, moonrise, moonset,
}: {
  sunrise?: string | null;
  sunset?: string | null;
  moonrise?: string | null;
  moonset?: string | null;
}) {
  if (!sunrise || !sunset) return null;

  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const now   = new Date().getHours() * 60 + new Date().getMinutes();
  const rise  = toMin(sunrise);
  const set   = toMin(sunset);
  const total = 24 * 60;

  // Twilight offsets (minutes)
  const astroOff     = 90;
  const nauticalOff  = 62;
  const civilOff     = 30;

  // Percentage helper — clamps to [0, 100]
  const pct = (min: number) =>
    `${(Math.min(total, Math.max(0, min)) / total * 100).toFixed(2)}%`;

  // Gradient: transparent night → blue twilight zones → golden day
  const gradient = [
    `rgba(20,15,50,0) 0%`,
    `rgba(20,15,50,0) ${pct(rise - astroOff)}`,
    `rgba(50,30,120,0.30) ${pct(rise - nauticalOff)}`,
    `rgba(130,70,210,0.48) ${pct(rise - civilOff)}`,
    `rgba(255,160,40,0.70) ${pct(rise)}`,
    `rgba(255,205,65,0.62) ${pct((rise + set) / 2)}`,
    `rgba(255,160,40,0.70) ${pct(set)}`,
    `rgba(130,70,210,0.48) ${pct(set + civilOff)}`,
    `rgba(50,30,120,0.30) ${pct(set + nauticalOff)}`,
    `rgba(20,15,50,0) ${pct(set + astroOff)}`,
    `rgba(20,15,50,0) 100%`,
  ].join(', ');

  // ── Moon arc segments (may cross midnight) ───────────────────────────────
  const moonArcSegments: Array<{ left: number; width: number }> = [];
  if (moonrise && moonset) {
    const mRise = toMin(moonrise);
    const mSet  = toMin(moonset);
    if (mRise < mSet) {
      // normal: moonrise before moonset on the same day
      moonArcSegments.push({
        left:  mRise / total * 100,
        width: (mSet - mRise) / total * 100,
      });
    } else {
      // crosses midnight: two segments
      moonArcSegments.push({ left: 0, width: mSet / total * 100 });
      moonArcSegments.push({ left: mRise / total * 100, width: (total - mRise) / total * 100 });
    }
  }

  return (
    <div>
      {/* Bar */}
      <div
        className="relative h-3 rounded-full mt-3"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        {/* Moon-above-horizon arc — rendered first so sun gradient sits on top */}
        {moonArcSegments.map((seg, i) => (
          <div
            key={i}
            className="absolute top-0 h-full"
            style={{
              left:    `${seg.left.toFixed(2)}%`,
              width:   `${seg.width.toFixed(2)}%`,
              background: 'rgba(160,180,255,0.65)',
              borderTop:    '2px solid rgba(180,200,255,0.90)',
              borderBottom: '2px solid rgba(180,200,255,0.90)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 10px, black calc(100% - 10px), transparent 100%)',
              maskImage: 'linear-gradient(to right, transparent 0%, black 10px, black calc(100% - 10px), transparent 100%)',
            }}
          />
        ))}
        {/* Twilight + day gradient overlay — always on top of moon arc */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: `linear-gradient(to right, ${gradient})` }}
        />
        {/* Current-time dot */}
        <div
          className="absolute top-1/2 w-2 h-2 rounded-full -translate-y-1/2 -translate-x-1/2 z-10"
          style={{
            left: `${(now / total * 100).toFixed(2)}%`,
            background: 'rgba(255,255,255,0.92)',
            boxShadow: '0 0 5px rgba(255,255,255,0.65)',
          }}
        />
      </div>

      {/* Moon rise / set row */}
      {(moonrise || moonset) && (
        <div className="flex items-center justify-between mt-2 text-xs"
             style={{ color: 'var(--ink-faint)' }}>
          <span className="flex items-center gap-1.5">
            <MoonHorizonIcon dir="rise" />
            <span>{moonrise ?? '—'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <MoonHorizonIcon dir="set" />
            <span>{moonset ?? '—'}</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SunMoonCard({ reading }: { reading: WeatherReading | null }) {
  const t = useTranslations('weather');
  const phase = moonPhaseNow();
  const illum = moonIllumination(phase);
  const phaseKey = moonPhaseKey(phase);

  return (
    <div className="card p-5 h-full">
      <p className="label mb-4">{t('sunMoon')}</p>

      {/* Moon phase row */}
      <div className="flex items-center gap-4 mb-4">
        <MoonPhaseSVG phase={phase} size={52} />
        <div>
          <div className="text-sm font-light" style={{ color: 'var(--ink)' }}>{t(`moonPhaseNames.${phaseKey}`)}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>
            {t('illuminated', { pct: illum })}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginBottom: '0.75rem' }} />

      {/* Sun times */}
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

      {/* Timeline bar (with twilight) + moon times below */}
      <TimelineBar
        sunrise={reading?.sunrise}
        sunset={reading?.sunset}
        moonrise={reading?.moonrise}
        moonset={reading?.moonset}
      />
    </div>
  );
}
