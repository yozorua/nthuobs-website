'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { MeteoblueForecastEntry, PrecipPeriod } from './types';

// ── Color functions ────────────────────────────────────────────────────────

function cloudColor(pct: number, dark: boolean): string {
  const p = Math.min(Math.max(pct, 0), 100) / 100;
  if (dark) {
    return `hsl(220, ${50 - p * 30}%, ${15 + p * 75}%)`;
  } else {
    return `hsl(${210 + p * 10}, ${55 - p * 49}%, ${78 - p * 26}%)`;
  }
}

// Green (good, 0.8″) → red (poor, 3.0″+)
function seeingColor(arcsec: number, dark: boolean): string {
  const p = Math.min(Math.max(arcsec - 0.8, 0) / (3.0 - 0.8), 1);
  const hue = 130 * (1 - p);
  if (dark) {
    return `hsl(${hue}, ${70 - p * 20}%, ${30 + p * 10}%)`;
  } else {
    return `hsl(${hue}, ${65 - p * 15}%, ${40 + p * 10}%)`;
  }
}

// Transparent (0%) → sky-blue (50%) → deep blue (100%)
function precipColor(pop: number, dark: boolean): string {
  if (pop <= 0) return 'transparent';
  const p = Math.min(Math.max(pop, 0), 100) / 100;
  if (dark) {
    // 0 → transparent, 10 → faint sky, 100 → saturated blue
    const alpha = 0.15 + p * 0.75;
    const lightness = 55 - p * 20;
    return `hsla(205, ${60 + p * 20}%, ${lightness}%, ${alpha})`;
  } else {
    const alpha = 0.20 + p * 0.65;
    return `hsla(210, ${55 + p * 20}%, ${65 - p * 20}%, ${alpha})`;
  }
}

// ── Dark-mode detection ────────────────────────────────────────────────────

function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    setDark(root.classList.contains('dark'));
    const obs = new MutationObserver(() => setDark(root.classList.contains('dark')));
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ── Precipitation lookup ───────────────────────────────────────────────────
// Returns the PoP for a forecast block (date + hour string).
// The CWA data uses 6-hour windows; we find the window that contains this hour.
function lookupPop(
  date: string,
  hourStr: string,
  periods: PrecipPeriod[],
): number | null {
  if (!periods.length) return null;
  const hour = parseInt(hourStr, 10);
  // Build an ISO-ish timestamp for the middle of this hour
  const ts = new Date(`${date}T${String(hour).padStart(2, '0')}:30:00+08:00`).getTime();
  for (const p of periods) {
    const s = new Date(p.start).getTime();
    const e = new Date(p.end).getTime();
    if (ts >= s && ts < e) return p.pop;
  }
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  forecast: MeteoblueForecastEntry[];
  stationDate: string;
  stationTime: string;
  forceDark?: boolean;
  precipForecast?: PrecipPeriod[];
}

const BLOCK_W = 24; // px

export default function CloudSeeingGrid({
  forecast, stationDate, stationTime, forceDark, precipForecast = [],
}: Props) {
  const t = useTranslations('weather');
  const isDark = useIsDark();
  const dark = forceDark ?? isDark;
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  const nowDate = new Date();
  const currentHour = nowDate.getHours();
  const todayDate = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (!scrollRef.current || !currentRef.current) return;
    const container = scrollRef.current;
    const el = currentRef.current;
    const left = el.offsetLeft - container.clientWidth / 2 + BLOCK_W / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [forecast, stationDate, stationTime]);

  if (forecast.length === 0) return null;

  // Group consecutive entries by date for the date-banner row
  const dateGroups: { date: string; count: number }[] = [];
  for (const e of forecast) {
    const last = dateGroups[dateGroups.length - 1];
    if (last && last.date === e.date) {
      last.count++;
    } else {
      dateGroups.push({ date: e.date, count: 1 });
    }
  }

  const hasPrecip = precipForecast.length > 0;

  const rows: {
    key: string;
    label: string;
    subLabel?: string;
    render: (e: MeteoblueForecastEntry) => ReactNode;
  }[] = [
    {
      key: 'high',
      label: t('cloudHigh'),
      subLabel: '>6km',
      render: (e) => {
        const v = parseFloat(e.clouds_high);
        return (
          <div
            className="shrink-0 rounded-sm"
            style={{ width: BLOCK_W, height: 16, backgroundColor: cloudColor(isNaN(v) ? 0 : v, dark) }}
            title={`${t('cloudHigh')}: ${e.clouds_high}%  ${e.date} ${e.time}:00`}
          />
        );
      },
    },
    {
      key: 'mid',
      label: t('cloudMid'),
      subLabel: '2–6km',
      render: (e) => {
        const v = parseFloat(e.clouds_mid);
        return (
          <div
            className="shrink-0 rounded-sm"
            style={{ width: BLOCK_W, height: 16, backgroundColor: cloudColor(isNaN(v) ? 0 : v, dark) }}
            title={`${t('cloudMid')}: ${e.clouds_mid}%  ${e.date} ${e.time}:00`}
          />
        );
      },
    },
    {
      key: 'low',
      label: t('cloudLow'),
      subLabel: '<2km',
      render: (e) => {
        const v = parseFloat(e.clouds_low);
        return (
          <div
            className="shrink-0 rounded-sm"
            style={{ width: BLOCK_W, height: 16, backgroundColor: cloudColor(isNaN(v) ? 0 : v, dark) }}
            title={`${t('cloudLow')}: ${e.clouds_low}%  ${e.date} ${e.time}:00`}
          />
        );
      },
    },
    {
      key: 'seeing',
      label: t('seeing'),
      render: (e) => {
        const v = parseFloat(e.seeing);
        return (
          <div
            className="shrink-0 rounded-sm"
            style={{ width: BLOCK_W, height: 16, backgroundColor: seeingColor(isNaN(v) ? 3 : v, dark) }}
            title={`${t('seeing')}: ${e.seeing}″  ${e.date} ${e.time}:00`}
          />
        );
      },
    },
    // Precipitation row — only rendered when CWA data is available
    ...(hasPrecip ? [{
      key: 'precip',
      label: 'Rain%',
      render: (e: MeteoblueForecastEntry) => {
        const pop = lookupPop(e.date, e.time, precipForecast);
        const bg = pop !== null ? precipColor(pop, dark) : 'rgba(255,255,255,0.04)';
        const label = pop !== null ? `${pop}%` : '—';
        return (
          <div
            className="shrink-0 rounded-sm flex items-center justify-center"
            style={{ width: BLOCK_W, height: 16, backgroundColor: bg }}
            title={`Precipitation: ${label}  ${e.date} ${e.time}:00`}
          >
            {pop !== null && pop >= 30 && (
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', lineHeight: 1 }}>
                {pop}
              </span>
            )}
          </div>
        );
      },
    }] : []),
  ];

  return (
    <div className="card p-5">
      <p className="label mb-4">{t('cloudSeeing')}</p>

      <div className="flex gap-2">
        {/* ── Label column (doesn't scroll) ── */}
        <div className="shrink-0 flex flex-col" style={{ gap: 2 }}>
          <div style={{ height: 34 }} /> {/* spacer for date banner + hour row */}
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex flex-col justify-center"
              style={{ height: 16, marginBottom: row.key === 'low' ? 6 : 0 }}
            >
              <span className="text-xs leading-none" style={{ color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                {row.label}
                {row.subLabel && (
                  <span className="ml-1 text-[10px]" style={{ color: 'var(--ink-faint)', opacity: 0.55 }}>
                    {row.subLabel}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        {/* ── Scrollable block grid ── */}
        {/* eslint-disable-next-line react/no-unknown-property */}
        <style>{`.cs-scroll::-webkit-scrollbar { display: none; }`}</style>
        <div
          ref={scrollRef}
          className="overflow-x-auto flex-1 cs-scroll"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        >
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>

            {/* Date banner row */}
            <div className="flex" style={{ gap: 2, height: 16, marginBottom: 2 }}>
              {dateGroups.map((g, gi) => {
                const w = g.count * BLOCK_W + (g.count - 1) * 2;
                return (
                  <div
                    key={gi}
                    style={{
                      width: w,
                      height: 16,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 3,
                      borderLeft: gi > 0 ? '1px solid var(--line-dark)' : undefined,
                    }}
                  >
                    <span
                      className="text-[10px] leading-none font-medium"
                      style={{ color: 'var(--ink-secondary)', letterSpacing: '0.02em' }}
                    >
                      {g.date.slice(5).replace('-', '/')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Hour axis */}
            <div className="flex" style={{ gap: 2, height: 16 }}>
              {forecast.map((e, i) => {
                const hour = parseInt(e.time, 10);
                const isCurrent = e.date === todayDate && hour === currentHour;
                return (
                  <div
                    key={i}
                    ref={isCurrent ? currentRef : undefined}
                    style={{
                      width: BLOCK_W,
                      height: 16,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isCurrent ? 'var(--bg-muted)' : undefined,
                      borderRadius: 2,
                    }}
                    title={`${e.date} ${e.time}:00`}
                  >
                    <span
                      className="text-[10px] leading-none"
                      style={{
                        color: isCurrent ? 'var(--ink)' : 'var(--ink-faint)',
                        fontWeight: isCurrent ? 600 : 400,
                      }}
                    >
                      {e.time}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Data rows */}
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex"
                style={{ gap: 2, marginBottom: row.key === 'low' ? 6 : 0 }}
              >
                {forecast.map((e, i) => {
                  const hour = parseInt(e.time, 10);
                  const isCurrent = e.date === todayDate && hour === currentHour;
                  return (
                    <div
                      key={i}
                      style={{
                        width: BLOCK_W,
                        flexShrink: 0,
                        outline: isCurrent ? '1px solid var(--ink-muted)' : undefined,
                        outlineOffset: -1,
                        borderRadius: 2,
                      }}
                    >
                      {row.render(e)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>Cloud:</span>
          <div
            className="rounded-sm"
            style={{
              width: 80,
              height: 10,
              background: `linear-gradient(to right, ${cloudColor(0, dark)}, ${cloudColor(50, dark)}, ${cloudColor(100, dark)})`,
            }}
          />
          <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>0 → 100%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>Seeing:</span>
          <div
            className="rounded-sm"
            style={{
              width: 80,
              height: 10,
              background: `linear-gradient(to right, ${seeingColor(0.8, dark)}, ${seeingColor(1.9, dark)}, ${seeingColor(3.0, dark)})`,
            }}
          />
          <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>0.8″ → 3.0″</span>
        </div>
        {hasPrecip && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>Rain%:</span>
            <div
              className="rounded-sm"
              style={{
                width: 80,
                height: 10,
                background: `linear-gradient(to right, ${precipColor(0, dark)}, ${precipColor(50, dark)}, ${precipColor(100, dark)})`,
              }}
            />
            <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>0 → 100%</span>
          </div>
        )}
      </div>
    </div>
  );
}
