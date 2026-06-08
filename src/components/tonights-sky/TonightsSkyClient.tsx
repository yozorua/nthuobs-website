'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  getNightWindow, getMoonInfo, getPlanetInfo, getDsoVisibility, thumbnailUrl, formatTime,
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

// Characteristic planet gradient + ring for Saturn
const PLANET_STYLE: Record<string, { bg: string; ring?: boolean }> = {
  Mercury: { bg: 'radial-gradient(circle at 38% 35%, #d4d2cc, #7a7870, #504e4a)' },
  Venus:   { bg: 'radial-gradient(circle at 38% 35%, #f5e8b8, #d4a84a, #9a7018)' },
  Mars:    { bg: 'radial-gradient(circle at 38% 35%, #e87060, #c03820, #801500)' },
  Jupiter: { bg: 'radial-gradient(circle at 38% 35%, #d4b480, #a07840, #d4c090, #a07840)' },
  Saturn:  { bg: 'radial-gradient(circle at 38% 35%, #ead8a0, #c4a030, #907010)', ring: true },
  Uranus:  { bg: 'radial-gradient(circle at 38% 35%, #c0f0ec, #70c0b8, #40908a)' },
  Neptune: { bg: 'radial-gradient(circle at 38% 35%, #5070e8, #2840c0, #102080)' },
};

// Moon glyph + CSS phase disc
const MOON_GLYPHS: Record<MoonPhaseKey, string> = {
  moonNew:            '🌑', moonWaxingCrescent: '🌒', moonFirstQuarter: '🌓',
  moonWaxingGibbous:  '🌔', moonFull:           '🌕', moonWaningGibbous: '🌖',
  moonLastQuarter:    '🌗', moonWaningCrescent: '🌘',
};

type SortKey = 'name' | 'type' | 'currentAlt' | 'peakAlt' | 'bestTime' | 'mag';

interface DsoRow {
  obj: MessierObject;
  currentAlt: number;
  currentRising: boolean;
  maxAltitude: number;
  transitTime: Date | null;
}

function PlanetSphere({ name, size = 40 }: { name: string; size?: number }) {
  const style = PLANET_STYLE[name];
  if (!style) return null;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: style.bg,
        boxShadow: 'inset -4px -3px 8px rgba(0,0,0,0.5)',
      }} />
      {style.ring && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: size * 1.7, height: size * 0.36,
          marginLeft: -(size * 1.7) / 2,
          marginTop: -(size * 0.36) / 2,
          borderRadius: '50%',
          border: `${size * 0.065}px solid rgba(210,180,80,0.55)`,
          transform: 'rotateX(72deg)',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

function AltBadge({ alt, rising }: { alt: number; rising: boolean }) {
  if (alt < -2) return <span style={{ color: 'var(--ink-faint)' }}>—</span>;
  const color = alt > 40 ? '#4ade80' : alt > 20 ? '#facc15' : '#fb923c';
  return (
    <span className="font-mono text-sm inline-flex items-center gap-1" style={{ color }}>
      {alt.toFixed(0)}°
      <span style={{ fontSize: '1rem', lineHeight: 1, fontFamily: 'inherit' }}>
        {rising ? '↑' : '↓'}
      </span>
    </span>
  );
}

function DsoThumbnail({ obj }: { obj: MessierObject }) {
  const [err, setErr] = useState(false);
  const fovDeg = Math.max(0.08, (obj.size / 60) * 2.5);
  const src = thumbnailUrl(obj.ra, obj.dec, fovDeg);
  if (err) return (
    <div className="flex items-center justify-center" style={{ width: 48, height: 48, background: '#080c14', flexShrink: 0, color: 'var(--ink-faint)', fontSize: 12 }}>✦</div>
  );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={48} height={48}
      style={{ width: 48, height: 48, objectFit: 'cover', flexShrink: 0, background: '#080c14' }}
      onError={() => setErr(true)}
    />
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
  const [sortKey, setSortKey]   = useState<SortKey>('peakAlt');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc');

  const now = useMemo(() => new Date(), []);

  const { night, moon, planets, dsoRows } = useMemo(() => {
    const night = getNightWindow(now);
    const moon  = getMoonInfo(now);

    const planets = PLANETS
      .map(p => getPlanetInfo(p.body, p.name, night, now))
      .filter(p => p.visible)
      .sort((a, b) => b.peakAlt - a.peakAlt);

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

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">

      {/* Header */}
      <div className="mb-14 pb-8" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="label mb-3">{t('serviceLabel')}</p>
        <h1 className="text-3xl font-light tracking-wider mb-2" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{dateLabel}</p>
      </div>

      {/* Dark hours + Moon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">

        {/* Dark hours */}
        <div className="p-5" style={{ border: '1px solid var(--line)' }}>
          <p className="label mb-4">{t('darkHours')}</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs mb-1" style={{ color: 'var(--ink-faint)' }}>{t('dusk')}</p>
              <p className="text-2xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
                {formatTime(night.start, locale)}
              </p>
            </div>
            <div style={{ color: 'var(--line)', fontSize: '1.5rem', fontWeight: 100 }}>—</div>
            <div className="flex-1">
              <p className="text-xs mb-1" style={{ color: 'var(--ink-faint)' }}>{t('dawn')}</p>
              <p className="text-2xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
                {formatTime(night.end, locale)}
              </p>
            </div>
          </div>
        </div>

        {/* Moon */}
        <div className="p-5" style={{ border: '1px solid var(--line)' }}>
          <p className="label mb-4">{t('moon')}</p>
          <div className="flex items-center gap-4 mb-3">
            <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{MOON_GLYPHS[moon.phaseKey]}</span>
            <div>
              <p className="text-base" style={{ color: 'var(--ink)' }}>
                {t(moon.phaseKey as Parameters<typeof t>[0])}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="h-1 rounded overflow-hidden" style={{ width: 72, background: 'var(--line)' }}>
                  <div className="h-full rounded" style={{ width: `${(moon.illumination * 100).toFixed(0)}%`, background: 'var(--ink-faint)' }} />
                </div>
                <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                  {(moon.illumination * 100).toFixed(0)}% {t('illuminated')}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-5">
            <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>↑ {formatTime(moon.riseTime, locale)}</span>
            <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>↓ {formatTime(moon.setTime, locale)}</span>
          </div>
        </div>
      </div>

      {/* Planets */}
      {planets.length > 0 && (
        <div className="mb-10">
          <p className="text-xs font-medium tracking-ultra uppercase mb-4" style={{ color: 'var(--ink-secondary)' }}>
            {t('planetsTonight')} · {planets.length}
          </p>
          <div className="flex flex-wrap gap-3">
            {planets.map(p => (
              <div key={p.name} className="flex items-center gap-3 px-4 py-3" style={{ border: '1px solid var(--line)', minWidth: 160 }}>
                <PlanetSphere name={p.name} size={38} />
                <div className="min-w-0">
                  <p className="text-sm mb-0.5" style={{ color: 'var(--ink)' }}>
                    {t(PLANET_I18N_KEY[p.name] as Parameters<typeof t>[0])}
                  </p>
                  <div className="flex items-center gap-2">
                    <AltBadge alt={p.currentAlt} rising={p.currentRising} />
                    <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>mag {p.magnitude.toFixed(1)}</span>
                  </div>
                  <div className="flex gap-3 mt-1">
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
        {/* Section header + type filters */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p className="text-xs font-medium tracking-ultra uppercase" style={{ color: 'var(--ink-secondary)' }}>
            {t('deepSkyObjects')} · {sorted.length}
          </p>
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
              return (
                <button
                  key={type}
                  onClick={() => setFilter(active ? 'all' : type)}
                  className="text-xs px-2.5 py-1 tracking-wide transition-colors"
                  style={{
                    border: `1px solid ${active ? TYPE_COLORS[type] : 'var(--line)'}`,
                    background: active ? `${TYPE_COLORS[type]}18` : 'transparent',
                    color: active ? TYPE_COLORS[type] : 'var(--ink-faint)',
                  }}
                >
                  {t(TYPE_I18N_KEY[type] as Parameters<typeof t>[0])}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th className="pb-3 pr-3 w-12" />
                <SortTh label={t('colObject')}  sortKey="name"       current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label={t('colType')}    sortKey="type"       current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label={t('colNow')}     sortKey="currentAlt" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label={t('colPeak')}    sortKey="peakAlt"    current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label={t('colBest')}    sortKey="bestTime"   current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label={t('colMag')}     sortKey="mag"        current={sortKey} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ obj, currentAlt, currentRising, maxAltitude, transitTime }) => {
                const color = TYPE_COLORS[obj.type];
                const label = obj.name ? `${obj.id} · ${obj.name}` : obj.id;
                return (
                  <tr
                    key={obj.id}
                    className="hover-bg"
                    style={{ borderBottom: '1px solid var(--line)' }}
                  >
                    {/* Thumbnail */}
                    <td className="py-2 pr-3">
                      <DsoThumbnail obj={obj} />
                    </td>

                    {/* Object */}
                    <td className="py-2 pr-5" style={{ whiteSpace: 'nowrap' }}>
                      <p className="text-sm" style={{ color: 'var(--ink)' }}>{label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{obj.constellation}</p>
                    </td>

                    {/* Type */}
                    <td className="py-2 pr-5">
                      <span
                        className="text-xs px-1.5 py-0.5 whitespace-nowrap"
                        style={{ background: `${color}18`, color }}
                      >
                        {t(TYPE_I18N_KEY[obj.type] as Parameters<typeof t>[0])}
                      </span>
                    </td>

                    {/* Now */}
                    <td className="py-2 pr-5 whitespace-nowrap">
                      <AltBadge alt={currentAlt} rising={currentRising} />
                    </td>

                    {/* Peak */}
                    <td className="py-2 pr-5 whitespace-nowrap">
                      <span className="font-mono text-sm" style={{ color: 'var(--ink-secondary)' }}>
                        {maxAltitude.toFixed(0)}°
                      </span>
                    </td>

                    {/* Best Time */}
                    <td className="py-2 pr-5 whitespace-nowrap">
                      <span className="text-sm" style={{ color: 'var(--ink-secondary)' }}>
                        {formatTime(transitTime, locale)}
                      </span>
                    </td>

                    {/* Magnitude */}
                    <td className="py-2 whitespace-nowrap">
                      <span className="font-mono text-sm" style={{ color: 'var(--ink-secondary)' }}>
                        {obj.mag.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm" style={{ color: 'var(--ink-faint)' }}>
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
