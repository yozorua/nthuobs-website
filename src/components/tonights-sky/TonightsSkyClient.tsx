'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  getNightWindow, getMoonInfo, getPlanetInfo, getDsoVisibility, formatTime,
  PLANETS, MoonPhaseKey,
} from '@/lib/astronomy';
import { MESSIER, DsoType, TYPE_COLORS, MessierObject } from '@/data/messier';
import { NGC } from '@/data/ngc';

interface TonightsSkyClientProps { locale: string; }

const ALL_DSO = [...MESSIER, ...NGC];

const ALL_TYPES: DsoType[] = [
  'Galaxy', 'Globular Cluster', 'Open Cluster', 'Nebula',
  'Planetary Nebula', 'Supernova Remnant', 'Cluster + Nebula',
];

const TYPE_I18N_KEY: Record<DsoType, string> = {
  'Galaxy':            'typeGalaxy',
  'Globular Cluster':  'typeGlobularCluster',
  'Open Cluster':      'typeOpenCluster',
  'Nebula':            'typeNebula',
  'Planetary Nebula':  'typePlanetaryNebula',
  'Supernova Remnant': 'typeSupernovaRemnant',
  'Cluster + Nebula':  'typeClusterNebula',
};

const PLANET_I18N_KEY: Record<string, string> = {
  Mercury: 'planetMercury', Venus: 'planetVenus',  Mars:    'planetMars',
  Jupiter: 'planetJupiter', Saturn: 'planetSaturn', Uranus:  'planetUranus',
  Neptune: 'planetNeptune',
};

const PLANET_COLOR: Record<string, string> = {
  Mercury: '#9a9894',
  Venus:   '#d4b96e',
  Mars:    '#c4553a',
  Jupiter: '#b8956e',
  Saturn:  '#c8aa72',
  Uranus:  '#6ab8b0',
  Neptune: '#3a54c0',
};


type SortKey = 'name' | 'type' | 'currentAlt' | 'peakAlt' | 'bestTime' | 'mag';

interface DsoRow {
  obj: MessierObject;
  currentAlt: number;
  currentRising: boolean;
  maxAltitude: number;
  transitTime: Date | null;
}

// Geometric SVG moon phase — two-arc method
function MoonIcon({ illumination, phaseKey }: { illumination: number; phaseKey: MoonPhaseKey }) {
  const s = 40, r = 14, cx = 20, cy = 20;
  const waxing = ['moonWaxingCrescent', 'moonFirstQuarter', 'moonWaxingGibbous', 'moonFull'].includes(phaseKey);
  const rx = Math.abs(2 * illumination - 1) * r;
  const top = `${cx} ${cy - r}`;
  const bot = `${cx} ${cy + r}`;
  const outerSweep = waxing ? 1 : 0;
  const innerSweep = waxing ? (illumination < 0.5 ? 1 : 0) : (illumination < 0.5 ? 0 : 1);
  const litPath = `M ${top} A ${r} ${r} 0 0 ${outerSweep} ${bot} A ${rx} ${r} 0 0 ${innerSweep} ${top} Z`;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="var(--line-dark)" />
      {illumination > 0.02 && <path d={litPath} fill="var(--ink-secondary)" />}
    </svg>
  );
}

// Flat planet: solid circle, Saturn gets a wide flat ring
function PlanetIcon({ name, size = 34 }: { name: string; size?: number }) {
  const color = PLANET_COLOR[name] ?? '#888';
  const isSaturn = name === 'Saturn';
  const ringW = size * 1.8;
  const ringH = size * 0.34;

  return (
    <div style={{ position: 'relative', width: isSaturn ? ringW : size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {isSaturn && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: ringW, height: ringH,
          marginLeft: -ringW / 2, marginTop: -ringH / 2,
          borderRadius: '50%',
          border: `${size * 0.13}px solid ${color}`,
          opacity: 0.65,
          transform: 'rotateX(68deg)',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: color,
        flexShrink: 0, position: 'relative', zIndex: 1,
      }} />
    </div>
  );
}

// Flat geometric SVG icon per DSO type
function DsoTypeIcon({ type, color, size = 30 }: { type: DsoType; color: string; size?: number }) {
  const c = size / 2;
  const fill = `${color}22`;
  switch (type) {
    case 'Galaxy':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <ellipse cx={c} cy={c} rx={c * 0.76} ry={c * 0.28} fill="none" stroke={color} strokeWidth="1.4" transform={`rotate(-28 ${c} ${c})`} />
          <circle cx={c} cy={c} r={2.2} fill={color} />
        </svg>
      );
    case 'Open Cluster':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {([ [-0.34,-0.34],[0,-0.44],[0.34,-0.34],[-0.44,0],[0.44,0],[-0.34,0.34],[0,0.44],[0.34,0.34] ] as [number,number][]).map(([dx, dy], i) => (
            <circle key={i} cx={c + dx * c} cy={c + dy * c} r={i % 3 === 0 ? 2.2 : 1.5} fill={color} />
          ))}
        </svg>
      );
    case 'Globular Cluster':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={c} cy={c} r={c * 0.68} fill="none" stroke={color} strokeWidth="1.2" />
          {([0, 60, 120, 180, 240, 300] as number[]).map(a => (
            <line key={a}
              x1={c} y1={c}
              x2={c + Math.cos(a * Math.PI / 180) * c * 0.68}
              y2={c + Math.sin(a * Math.PI / 180) * c * 0.68}
              stroke={color} strokeWidth="0.9" />
          ))}
          <circle cx={c} cy={c} r={2.5} fill={color} />
        </svg>
      );
    case 'Nebula':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <ellipse cx={c} cy={c} rx={c * 0.78} ry={c * 0.46} fill={fill} stroke={color} strokeWidth="1.4" />
          <ellipse cx={c} cy={c} rx={c * 0.38} ry={c * 0.68} fill={fill} stroke={color} strokeWidth="1.1" />
        </svg>
      );
    case 'Planetary Nebula':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={c} cy={c} r={c * 0.72} fill="none" stroke={color} strokeWidth="1.4" />
          <circle cx={c} cy={c} r={c * 0.28} fill={color} opacity="0.75" />
        </svg>
      );
    case 'Supernova Remnant':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {([0, 45, 90, 135, 180, 225, 270, 315] as number[]).map(a => (
            <line key={a}
              x1={c + Math.cos(a * Math.PI / 180) * c * 0.28}
              y1={c + Math.sin(a * Math.PI / 180) * c * 0.28}
              x2={c + Math.cos(a * Math.PI / 180) * c * 0.82}
              y2={c + Math.sin(a * Math.PI / 180) * c * 0.82}
              stroke={color} strokeWidth="1.5" />
          ))}
          <circle cx={c} cy={c} r={c * 0.22} fill={color} opacity="0.65" />
        </svg>
      );
    case 'Cluster + Nebula':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <ellipse cx={c} cy={c} rx={c * 0.74} ry={c * 0.44} fill={fill} stroke={color} strokeWidth="1.2" />
          {([ [-0.3,-0.08],[0.3,-0.08],[0,0.26],[-0.16,0.12],[0.16,0.12] ] as [number,number][]).map(([dx, dy], i) => (
            <circle key={i} cx={c + dx * c} cy={c + dy * c} r={1.6} fill={color} />
          ))}
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={c} cy={c} r={c * 0.68} fill="none" stroke={color} strokeWidth="1.4" />
        </svg>
      );
  }
}

// Dusk / dawn flat sun-horizon icon
function SunHorizonIcon({ type }: { type: 'dusk' | 'dawn' }) {
  const s = 18, c = s / 2;
  const isDawn = type === 'dawn';
  // For dawn: sun rises above horizon (arc on top); for dusk: sun sets below
  const arcD = isDawn
    ? `M ${c - 5} ${c} A 5 5 0 0 1 ${c + 5} ${c}`
    : `M ${c - 5} ${c} A 5 5 0 0 0 ${c + 5} ${c}`;
  const rayAngles = isDawn ? [270, 315, 225] : [90, 45, 135];

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ flexShrink: 0 }}>
      <line x1={2} y1={c} x2={s - 2} y2={c} stroke="currentColor" strokeWidth="1.1" />
      <path d={arcD} fill="none" stroke="currentColor" strokeWidth="1.4" />
      {rayAngles.map(a => (
        <line key={a}
          x1={c + Math.cos(a * Math.PI / 180) * 6.5}
          y1={c + Math.sin(a * Math.PI / 180) * 6.5}
          x2={c + Math.cos(a * Math.PI / 180) * 8.5}
          y2={c + Math.sin(a * Math.PI / 180) * 8.5}
          stroke="currentColor" strokeWidth="1.1" />
      ))}
    </svg>
  );
}

function AltBadge({ alt, rising }: { alt: number; rising: boolean }) {
  if (alt < -2) return <span style={{ color: 'var(--ink-faint)' }}>—</span>;
  const color = alt > 40 ? '#4ade80' : alt > 20 ? '#facc15' : '#fb923c';
  return (
    <span className="font-mono text-sm inline-flex items-center gap-1" style={{ color }}>
      {alt.toFixed(0)}°
      <span style={{ fontSize: '0.8rem' }}>{rising ? '↑' : '↓'}</span>
    </span>
  );
}

function SortTh({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey;
  current: SortKey; dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="label pb-3 text-left cursor-pointer select-none whitespace-nowrap"
      style={{ paddingRight: '1.25rem', color: active ? 'var(--ink-secondary)' : 'var(--ink-faint)' }}
      onClick={() => onSort(sortKey)}
    >
      {label}
      <span className="ml-1" style={{ opacity: active ? 1 : 0.35 }}>
        {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  );
}

export default function TonightsSkyClient({ locale }: TonightsSkyClientProps) {
  const t = useTranslations('tonightsSky');
  const [filter, setFilter] = useState<DsoType | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('peakAlt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const now = useMemo(() => new Date(), []);

  const { night, moon, planets, dsoRows } = useMemo(() => {
    const night = getNightWindow(now);
    const moon  = getMoonInfo(now);

    const planets = PLANETS
      .map(p => getPlanetInfo(p.body, p.name, night, now))
      .filter(p => p.visible)
      .sort((a, b) => {
        const aUp = a.currentAlt > 0 ? 1 : 0;
        const bUp = b.currentAlt > 0 ? 1 : 0;
        if (aUp !== bUp) return bUp - aUp;
        return b.peakAlt - a.peakAlt;
      });

    const dsoRows: DsoRow[] = ALL_DSO
      .map(obj => {
        const vis = getDsoVisibility(obj.ra, obj.dec, night, now);
        return { obj, ...vis };
      })
      .filter(r => r.visible);

    return { night, moon, planets, dsoRows };
  }, [now]);

  const visibleTypes = useMemo(() => {
    const set = new Set(dsoRows.map(r => r.obj.type));
    return ALL_TYPES.filter(t => set.has(t));
  }, [dsoRows]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = useMemo(() => {
    const rows = filter === 'all' ? dsoRows : dsoRows.filter(r => r.obj.type === filter);
    return [...rows].sort((a, b) => {
      let va: number | string, vb: number | string;
      switch (sortKey) {
        case 'name':       va = a.obj.id; vb = b.obj.id; break;
        case 'type':       va = a.obj.type; vb = b.obj.type; break;
        case 'currentAlt': va = a.currentAlt; vb = b.currentAlt; break;
        case 'peakAlt':    va = a.maxAltitude; vb = b.maxAltitude; break;
        case 'bestTime':   va = a.transitTime?.getTime() ?? 0; vb = b.transitTime?.getTime() ?? 0; break;
        case 'mag':        va = a.obj.mag; vb = b.obj.mag; break;
        default:           va = 0; vb = 0;
      }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [dsoRows, filter, sortKey, sortDir]);

  const dateLabel = now.toLocaleDateString(locale === 'tw' ? 'zh-TW' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const moonPct = (moon.illumination * 100).toFixed(0);

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">

      {/* Header */}
      <div className="mb-6 pb-8" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="label mb-3">{t('serviceLabel')}</p>
        <h1 className="text-3xl font-light tracking-wider mb-2" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{dateLabel}</p>
      </div>

      {/* Dark hours + Moon — grid-divide cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px mb-12" style={{ background: 'var(--line)' }}>

        {/* Dark hours */}
        <div className="p-6" style={{ background: 'var(--bg)' }}>
          <p className="label mb-5">{t('darkHours')}</p>
          <div className="flex items-start gap-8">
            <div>
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--ink-faint)' }}>
                <SunHorizonIcon type="dusk" />
                <span className="text-xs tracking-wide">{t('dusk')}</span>
              </div>
              <p className="text-2xl font-light" style={{ color: 'var(--ink)', letterSpacing: '0.04em' }}>
                {formatTime(night.start, locale)}
              </p>
            </div>
            <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)', margin: '2px 0' }} />
            <div>
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--ink-faint)' }}>
                <SunHorizonIcon type="dawn" />
                <span className="text-xs tracking-wide">{t('dawn')}</span>
              </div>
              <p className="text-2xl font-light" style={{ color: 'var(--ink)', letterSpacing: '0.04em' }}>
                {formatTime(night.end, locale)}
              </p>
            </div>
          </div>
        </div>

        {/* Moon */}
        <div className="p-6" style={{ background: 'var(--bg)' }}>
          <p className="label mb-5">{t('moon')}</p>
          <div className="flex items-center gap-5">
            <MoonIcon illumination={moon.illumination} phaseKey={moon.phaseKey} />
            <div className="flex-1 min-w-0">
              <p className="text-base mb-2.5" style={{ color: 'var(--ink)' }}>
                {t(moon.phaseKey as Parameters<typeof t>[0])}
              </p>
              <div className="flex items-center gap-3 mb-2.5">
                <div className="flex-1 overflow-hidden" style={{ height: 2, background: 'var(--line)' }}>
                  <div style={{ width: `${moonPct}%`, height: '100%', background: 'var(--ink-secondary)' }} />
                </div>
                <span className="font-mono text-xs" style={{ color: 'var(--ink-faint)', minWidth: 34 }}>
                  {moonPct}%
                </span>
              </div>
              <div className="flex gap-4">
                {moon.riseTime && <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>↑ {formatTime(moon.riseTime, locale)}</span>}
                {moon.setTime  && <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>↓ {formatTime(moon.setTime, locale)}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Planets */}
      {planets.length > 0 && (
        <div className="mb-12">
          <p className="label mb-4">{t('planetsTonight')} · {planets.length}</p>
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-px"
            style={{ background: 'var(--line)' }}
          >
            {planets.map(p => (
              <div key={p.name} className="flex items-center gap-3 px-4 py-4" style={{ background: 'var(--bg)' }}>
                <PlanetIcon name={p.name} size={32} />
                <div className="min-w-0">
                  <p className="text-sm mb-0.5" style={{ color: 'var(--ink)' }}>
                    {t(PLANET_I18N_KEY[p.name] as Parameters<typeof t>[0])}
                  </p>
                  <div className="flex items-center gap-2 mb-0.5">
                    <AltBadge alt={p.currentAlt} rising={p.currentRising} />
                    <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>{t('mag')} {p.magnitude.toFixed(1)}</span>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>↑ {formatTime(p.riseTime, locale)}</span>
                    <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>↓ {formatTime(p.setTime, locale)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DSO table */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p className="label">{t('deepSkyObjects')} · {sorted.length}</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className="text-xs px-2.5 py-1 tracking-wide transition-colors"
              style={{
                border: '1px solid var(--line)',
                background: filter === 'all' ? 'var(--ink)' : 'transparent',
                color: filter === 'all' ? 'var(--bg)' : 'var(--ink-faint)',
              }}
            >
              {t('filterAll')}
            </button>
            {visibleTypes.map(type => {
              const active = filter === type;
              const color = TYPE_COLORS[type];
              return (
                <button
                  key={type}
                  onClick={() => setFilter(active ? 'all' : type)}
                  className="text-xs px-2.5 py-1 tracking-wide transition-colors"
                  style={{
                    border: `1px solid ${active ? color : 'var(--line)'}`,
                    background: active ? `${color}18` : 'transparent',
                    color: active ? color : 'var(--ink-faint)',
                  }}
                >
                  {t(TYPE_I18N_KEY[type] as Parameters<typeof t>[0])}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th className="pb-3 pr-3 w-10" />
                <SortTh label={t('colObject')}  sortKey="name"       current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label={t('colType')}    sortKey="type"       current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label={t('colNow')}     sortKey="currentAlt" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label={t('colPeak')}    sortKey="peakAlt"    current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label={t('colBest')}    sortKey="bestTime"   current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label={t('colMag')}     sortKey="mag"        current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="pb-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ obj, currentAlt, currentRising, maxAltitude, transitTime }) => {
                const color = TYPE_COLORS[obj.type];
                const label = obj.name ? `${obj.id} · ${obj.name}` : obj.id;
                return (
                  <tr key={obj.id} className="hover-bg" style={{ borderBottom: '1px solid var(--line)' }}>
                    <td className="py-2.5 pr-3">
                      <DsoTypeIcon type={obj.type} color={color} size={30} />
                    </td>
                    <td className="py-2.5 pr-5" style={{ whiteSpace: 'nowrap' }}>
                      <p className="text-sm" style={{ color: 'var(--ink)' }}>{label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{obj.constellation}</p>
                    </td>
                    <td className="py-2.5 pr-5">
                      <span className="text-xs px-1.5 py-0.5 whitespace-nowrap" style={{ background: `${color}18`, color }}>
                        {t(TYPE_I18N_KEY[obj.type] as Parameters<typeof t>[0])}
                      </span>
                    </td>
                    <td className="py-2.5 pr-5 whitespace-nowrap">
                      <AltBadge alt={currentAlt} rising={currentRising} />
                    </td>
                    <td className="py-2.5 pr-5 whitespace-nowrap">
                      <span className="font-mono text-sm" style={{ color: 'var(--ink-secondary)' }}>
                        {maxAltitude.toFixed(0)}°
                      </span>
                    </td>
                    <td className="py-2.5 pr-5 whitespace-nowrap">
                      <span className="text-sm" style={{ color: 'var(--ink-secondary)' }}>
                        {formatTime(transitTime, locale)}
                      </span>
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      <span className="font-mono text-sm" style={{ color: 'var(--ink-secondary)' }}>
                        {obj.mag.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <a
                        href={`/${locale}/services/planetarium?object=${encodeURIComponent(obj.id)}`}
                        title={`View ${obj.id} in planetarium`}
                        style={{ color: 'var(--ink-faint)', display: 'inline-flex', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm" style={{ color: 'var(--ink-faint)' }}>
                    {t('noneVisible')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
