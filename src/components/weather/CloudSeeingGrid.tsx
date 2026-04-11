'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { MeteoblueForecastEntry } from './types';

// ── Color functions ────────────────────────────────────────────────────────
//
// Dark mode:  dark navy (0%) → near-white (100%)  — blocks glow against dark bg
// Light mode: pale sky-blue (0%) → slate gray (100%) — white stays visible on light bg

function cloudColor(pct: number, dark: boolean): string {
  const p = Math.min(Math.max(pct, 0), 100) / 100;
  if (dark) {
    // 0% → hsl(220, 50%, 15%)   100% → hsl(220, 20%, 90%)
    return `hsl(220, ${50 - p * 30}%, ${15 + p * 75}%)`;
  } else {
    // 0% → hsl(210, 55%, 78%)   100% → hsl(220, 6%, 52%)
    return `hsl(${210 + p * 10}, ${55 - p * 49}%, ${78 - p * 26}%)`;
  }
}

// Green (good, 0.8″) → red (poor, 3.0″+)
// Dark mode: slightly lower lightness so colors are rich against dark bg
// Light mode: slightly higher lightness so colors read well on white

function seeingColor(arcsec: number, dark: boolean): string {
  const p = Math.min(Math.max(arcsec - 0.8, 0) / (3.0 - 0.8), 1);
  const hue = 130 * (1 - p);
  if (dark) {
    return `hsl(${hue}, ${70 - p * 20}%, ${30 + p * 10}%)`;
  } else {
    return `hsl(${hue}, ${65 - p * 15}%, ${40 + p * 10}%)`;
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

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  forecast: MeteoblueForecastEntry[];
  stationDate: string;
  stationTime: string;
}

const BLOCK_W = 24; // px

export default function CloudSeeingGrid({ forecast, stationDate, stationTime }: Props) {
  const t = useTranslations('weather');
  const dark = useIsDark();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  const currentHour = stationTime ? parseInt(stationTime.split(':')[0], 10) : -1;

  // Auto-scroll so the current hour is centred
  useEffect(() => {
    if (!scrollRef.current || !currentRef.current) return;
    const container = scrollRef.current;
    const el = currentRef.current;
    const left = el.offsetLeft - container.clientWidth / 2 + BLOCK_W / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [forecast, stationDate, stationTime]);

  if (forecast.length === 0) return null;

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
  ];

  return (
    <div className="card p-5" style={{ borderColor: 'var(--line)' }}>
      <p className="label mb-4">{t('cloudSeeing')}</p>

      <div className="flex gap-2">
        {/* ── Label column (doesn't scroll) ── */}
        <div className="shrink-0 flex flex-col" style={{ gap: 2 }}>
          <div style={{ height: 20 }} /> {/* spacer for time row */}
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
        <div ref={scrollRef} className="overflow-x-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>

            {/* Time axis */}
            <div className="flex" style={{ gap: 2, height: 20 }}>
              {forecast.map((e, i) => {
                const hour = parseInt(e.time, 10);
                const isCurrent = e.date === stationDate && hour === currentHour;
                const isDayStart = hour === 0;
                return (
                  <div
                    key={i}
                    ref={isCurrent ? currentRef : undefined}
                    style={{
                      width: BLOCK_W,
                      height: 20,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderLeft: isDayStart ? '1px solid var(--line-dark)' : undefined,
                      background: isCurrent ? 'var(--bg-muted)' : undefined,
                      borderRadius: 2,
                    }}
                    title={isDayStart ? e.date : `${e.date} ${e.time}:00`}
                  >
                    <span
                      className="text-[10px] leading-none"
                      style={{
                        color: isCurrent ? 'var(--ink)' : isDayStart ? 'var(--ink-secondary)' : 'var(--ink-faint)',
                        fontWeight: isCurrent || isDayStart ? 600 : 400,
                      }}
                    >
                      {isDayStart ? e.date.slice(5) : e.time}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Cloud & seeing rows */}
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex"
                style={{ gap: 2, marginBottom: row.key === 'low' ? 6 : 0 }}
              >
                {forecast.map((e, i) => {
                  const hour = parseInt(e.time, 10);
                  const isCurrent = e.date === stationDate && hour === currentHour;
                  const isDayStart = hour === 0;
                  return (
                    <div
                      key={i}
                      style={{
                        width: BLOCK_W,
                        flexShrink: 0,
                        borderLeft: isDayStart ? '1px solid var(--line-dark)' : undefined,
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
      </div>
    </div>
  );
}
