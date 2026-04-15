'use client';

import { useEffect, useState, startTransition } from 'react';
import { useTranslations } from 'next-intl';
import { WeatherReading, ChartRow, MeteoblueForecastEntry, CwaForecastPeriod } from './types';
import InstrumentPanel from './InstrumentPanel';
import SunMoonCard from './SunMoonCard';
import CwaForecastCard from './CwaForecastCard';
import CloudSeeingGrid from './CloudSeeingGrid';
import WeatherChart from './WeatherChart';
import AllSkyCamera from './AllSkyCamera';
import MeteogramEmbed from './MeteogramEmbed';
import WindCard from './WindCard';
import RainCard from './RainCard';
import AtmosphereCanvas, { computeSunPosition, AtmosphereCondition } from './AtmosphereCanvas';
import RainCanvas from './RainCanvas';
import { ALLSKY_REFRESH_INTERVAL_MS } from '@/config/observatory';

const REFRESH_MS = 15_000;
const CWA_REFRESH_MS = 10 * 60 * 1000;

// ── Dark-mode detection ───────────────────────────────────────────────────
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

// ── Pick the forecast entry closest to (but not exceeding) the current hour ──
// Meteoblue uses 3-hour intervals (0,3,6,…) so an exact-hour match may not
// exist — we take the most recent entry whose hour ≤ now.
function currentForecastEntry(
  forecast: MeteoblueForecastEntry[],
): MeteoblueForecastEntry | null {
  const now = new Date();
  const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentHour = now.getHours();

  let best: MeteoblueForecastEntry | null = null;
  for (const e of forecast) {
    if (e.date !== todayDate) continue;
    const h = parseInt(e.time, 10);
    if (h <= currentHour) {
      if (!best || parseInt(best.time, 10) < h) best = e;
    }
  }
  return best;
}

// ── Condition key ─────────────────────────────────────────────────────────
function conditionKey(
  r: WeatherReading | null,
  forecast: MeteoblueForecastEntry[],
): string {
  if (!r) return 'Unknown';
  if ((r.rainRateMmHr ?? 0) > 0) return 'Rainy';

  // Prefer live forecast cloud data aligned to actual current time; the DB
  // value may be null when the station time didn't match a forecast slot.
  const fc = currentForecastEntry(forecast);
  const cloudHigh = fc ? (parseFloat(fc.clouds_high) || 0) : (r.cloudCoverHigh ?? 0);
  const cloudMid  = fc ? (parseFloat(fc.clouds_mid)  || 0) : (r.cloudCoverMid  ?? 0);
  const cloudLow  = fc ? (parseFloat(fc.clouds_low)  || 0) : (r.cloudCoverLow  ?? 0);

  const cloud = Math.max(cloudHigh, cloudMid, cloudLow);
  if (cloud > 80) return 'Cloudy';
  if (cloud > 40) return 'PartlyCloudy';
  if ((r.windSpeedMs ?? 0) >= 10) return 'Windy';
  return 'Clear';
}

// ── Time period ───────────────────────────────────────────────────────────
export type TimePeriod = 'night' | 'dawn' | 'day' | 'dusk';

function getTimePeriod(nowMin: number, riseMin: number, setMin: number): TimePeriod {
  if (nowMin < riseMin - 60 || nowMin > setMin + 60) return 'night';
  if (nowMin < riseMin + 60) return 'dawn';
  if (nowMin > setMin - 60) return 'dusk';
  return 'day';
}

// ═══════════════════════════════════════════════════════════════════════════
//  Sky background — 4-stop gradient with smoothstep easing
// ═══════════════════════════════════════════════════════════════════════════

interface HSLA { h: number; s: number; l: number; a?: number }

// Smootherstep: C2-continuous, feels more organic than linear
function smootherstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function lerpHSLA(a: HSLA, b: HSLA, t: number): HSLA {
  // Start with shortest-arc hue interpolation
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;

  // Sky colours should never route through the green zone (hue ≈ 75–165°).
  // If the midpoint of the interpolation would land there, flip direction
  // so the path goes through warm purples/pinks instead.
  const midHue = ((a.h + dh * 0.5) % 360 + 360) % 360;
  if (midHue > 75 && midHue < 165) {
    dh = dh > 0 ? dh - 360 : dh + 360;
  }

  return { h: a.h + dh * t, s: lerp(a.s, b.s, t), l: lerp(a.l, b.l, t) };
}

function toHsl({ h, s, l }: HSLA) {
  return `hsl(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%)`;
}

// Each keyframe has 4 vertical stops: sky-top, upper-sky, lower-sky, horizon
interface Keyframe {
  min: number;
  s0: HSLA;   // 0%   sky apex
  s1: HSLA;   // 30%  upper sky
  s2: HSLA;   // 65%  lower sky
  s3: HSLA;   // 100% horizon
}

/*
 * Light-mode colour palette.
 * Dark mode: lightness × 0.42, saturation × 0.82
 *
 * Dawn/dusk targets (matching original warm palette):
 *   #2e1040 → hsl(283, 56%, 22%)  deep indigo-purple at apex
 *   #8c2c0e → hsl( 19, 85%, 30%)  dark burnt-orange upper
 *   #c85c1e → hsl( 20, 74%, 45%)  vivid orange lower
 *   #e0924a → hsl( 28, 68%, 59%)  warm golden horizon
 */
function buildKeyframes(riseMin: number, setMin: number, dark: boolean): Keyframe[] {
  const L = dark ? 0.42 : 1;
  const S = dark ? 0.82 : 1;

  const stop = (h: number, s: number, l: number): HSLA =>
    ({ h, s: s * S, l: l * L });

  return [
    // midnight ─────────────────────────────────────────────────────────────
    {
      min: 0,
      s0: stop(222, 82, 4),
      s1: stop(220, 72, 6),
      s2: stop(218, 62, 8),
      s3: stop(216, 52, 10),
    },
    // pre-dawn navy (riseMin − 90) ─────────────────────────────────────────
    {
      min: riseMin - 90,
      s0: stop(238, 68, 8),
      s1: stop(242, 62, 12),
      s2: stop(246, 56, 16),
      s3: stop(248, 48, 20),
    },
    // deep civil twilight (riseMin − 22) ──────────────────────────────────
    {
      min: riseMin - 22,
      s0: stop(260, 55, 14),
      s1: stop(278, 50, 20),
      s2: stop(295, 40, 26),
      s3: stop(308, 32, 32),
    },
    // sunrise (riseMin) ────────────────────────────────────────────────────
    // apex stays deep purple; horizon goes golden
    {
      min: riseMin,
      s0: stop(283, 56, 22),   // indigo-purple apex  ← original palette
      s1: stop(19,  82, 30),   // burnt-orange upper
      s2: stop(20,  74, 45),   // vivid orange lower
      s3: stop(28,  68, 59),   // warm golden horizon
    },
    // golden hour (riseMin + 38) ───────────────────────────────────────────
    {
      min: riseMin + 38,
      s0: stop(210, 62, 36),   // blue apex creeps in
      s1: stop(28,  60, 50),   // warm orange fading
      s2: stop(38,  68, 64),   // soft gold
      s3: stop(48,  72, 78),   // pale gold horizon
    },
    // morning (riseMin + 105) ──────────────────────────────────────────────
    {
      min: riseMin + 105,
      s0: stop(210, 74, 44),
      s1: stop(206, 66, 56),
      s2: stop(202, 52, 72),
      s3: stop(196, 38, 86),
    },
    // solar noon ───────────────────────────────────────────────────────────
    {
      min: 12 * 60,
      s0: stop(210, 84, 50),
      s1: stop(208, 76, 60),
      s2: stop(204, 56, 78),
      s3: stop(196, 36, 92),
    },
    // afternoon (setMin − 105) ─────────────────────────────────────────────
    {
      min: setMin - 105,
      s0: stop(208, 80, 48),
      s1: stop(205, 70, 58),
      s2: stop(200, 54, 74),
      s3: stop(194, 40, 88),
    },
    // golden hour (setMin − 38) ────────────────────────────────────────────
    {
      min: setMin - 38,
      s0: stop(210, 62, 36),
      s1: stop(30,  62, 50),
      s2: stop(40,  68, 64),
      s3: stop(50,  72, 76),
    },
    // sunset (setMin) ──────────────────────────────────────────────────────
    {
      min: setMin,
      s0: stop(283, 56, 22),
      s1: stop(19,  82, 30),
      s2: stop(20,  74, 45),
      s3: stop(28,  68, 59),
    },
    // dusk twilight (setMin + 22) ──────────────────────────────────────────
    {
      min: setMin + 22,
      s0: stop(260, 55, 14),
      s1: stop(278, 50, 20),
      s2: stop(295, 40, 26),
      s3: stop(308, 32, 32),
    },
    // early night (setMin + 90) ────────────────────────────────────────────
    {
      min: setMin + 90,
      s0: stop(238, 68, 8),
      s1: stop(242, 62, 12),
      s2: stop(246, 56, 16),
      s3: stop(248, 48, 20),
    },
    // midnight again ───────────────────────────────────────────────────────
    {
      min: 24 * 60,
      s0: stop(222, 82, 4),
      s1: stop(220, 72, 6),
      s2: stop(218, 62, 8),
      s3: stop(216, 52, 10),
    },
  ];
}

// Weather condition tweaks applied per-stop
function applyCondition(c: HSLA, cond: string, stopIdx: number): HSLA {
  // stopIdx: 0=apex, 3=horizon — keep bottom slightly brighter for rainy
  switch (cond) {
    case 'Rainy': {
      const lScale = stopIdx >= 2 ? 0.70 : 0.60;
      return { h: c.h + 6, s: c.s * 0.14, l: c.l * lScale };
    }
    case 'Cloudy':
      return { h: c.h, s: c.s * 0.20, l: c.l * 1.04 };
    case 'PartlyCloudy':
      return { h: c.h, s: c.s * 0.55, l: c.l * 0.96 };
    default:
      return c;
  }
}

function computeBackground(
  reading: WeatherReading | null,
  forecast: MeteoblueForecastEntry[],
  isDark: boolean,
  simMinutes?: number | null,
  conditionOverride?: string | null,
): string {
  const now = new Date();
  const currentMin = simMinutes ?? (now.getHours() * 60 + now.getMinutes());

  let riseMin = 6 * 60, setMin = 18 * 60;
  if (reading?.sunrise) {
    const [h, m] = reading.sunrise.split(':').map(Number);
    riseMin = (h ?? 6) * 60 + (m ?? 0);
  }
  if (reading?.sunset) {
    const [h, m] = reading.sunset.split(':').map(Number);
    setMin = (h ?? 18) * 60 + (m ?? 0);
  }

  const cond = conditionOverride ?? conditionKey(reading, forecast);
  const kfs = buildKeyframes(riseMin, setMin, isDark);

  // Locate bounding keyframes
  let a = kfs[0], b = kfs[kfs.length - 1];
  for (let i = 0; i < kfs.length - 1; i++) {
    if (currentMin >= kfs[i].min && currentMin < kfs[i + 1].min) {
      a = kfs[i]; b = kfs[i + 1]; break;
    }
  }

  // Smootherstep easing — slow at night/noon, fast near dawn/dusk
  const tRaw = (b.min - a.min) > 0 ? (currentMin - a.min) / (b.min - a.min) : 0;
  const t = smootherstep(tRaw);

  const blendStop = (sa: HSLA, sb: HSLA, idx: number): HSLA =>
    applyCondition(lerpHSLA(sa, sb, t), cond, idx);

  const c0 = blendStop(a.s0, b.s0, 0);
  const c1 = blendStop(a.s1, b.s1, 1);
  const c2 = blendStop(a.s2, b.s2, 2);
  const c3 = blendStop(a.s3, b.s3, 3);

  return (
    `linear-gradient(180deg, ` +
    `${toHsl(c0)} 0%, ` +
    `${toHsl(c1)} 30%, ` +
    `${toHsl(c2)} 65%, ` +
    `${toHsl(c3)} 100%)`
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────
function minToHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── Debug panel ───────────────────────────────────────────────────────────
const CONDITIONS = ['Clear', 'PartlyCloudy', 'Cloudy', 'Rainy', 'Windy'];

interface DebugPanelProps {
  simMinutes: number | null;
  conditionOverride: string | null;
  actualMinutes: number;
  actualCondition: string;
  sunrise: string;
  sunset: string;
  onSimMinutes: (v: number | null) => void;
  onCondition: (c: string | null) => void;
}

function DebugPanel({
  simMinutes, conditionOverride, actualMinutes, actualCondition,
  sunrise, sunset, onSimMinutes, onCondition,
}: DebugPanelProps) {
  const displayed = simMinutes ?? actualMinutes;

  const btnBase: React.CSSProperties = {
    padding: '2px 10px', fontSize: 11, cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.25)', background: 'transparent',
    color: 'rgba(255,255,255,0.70)', transition: 'all 0.15s',
  };
  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: 'rgba(255,255,255,0.85)',
    color: 'rgba(0,0,0,0.80)',
    border: '1px solid rgba(255,255,255,0.85)',
  };

  return (
    <div
      className="px-4 py-3 space-y-3"
      style={{
        border: '1px dashed var(--card-border)',
        background: 'var(--card-bg)',
        backdropFilter: 'var(--card-glass)',
        WebkitBackdropFilter: 'var(--card-glass)',
      }}
    >
      {/* Time slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="label" style={{ letterSpacing: '0.1em' }}>DEBUG · TIME</span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono"
              style={{ color: 'var(--ink-secondary)', minWidth: 40, textAlign: 'right' }}>
              {minToHHMM(displayed)}
            </span>
            {simMinutes !== null && (
              <button style={{ ...btnBase, padding: '1px 8px', fontSize: 10 }}
                onClick={() => onSimMinutes(null)}>
                reset
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px]" style={{ color: 'var(--ink-faint)' }}>00:00</span>
          <input
            type="range" min={0} max={1439} value={displayed}
            onChange={e => onSimMinutes(Number(e.target.value))}
            className="flex-1"
            style={{ accentColor: 'var(--accent)' }}
          />
          <span className="text-[9px]" style={{ color: 'var(--ink-faint)' }}>23:59</span>
        </div>
        <div className="flex gap-4 text-[10px]" style={{ color: 'var(--ink-faint)' }}>
          <span>☀ Rise {sunrise || '—'}</span>
          <span>☽ Set {sunset || '—'}</span>
          <span style={{ color: 'var(--ink-muted)' }}>actual {minToHHMM(actualMinutes)}</span>
        </div>
      </div>

      {/* Condition buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="label" style={{ letterSpacing: '0.1em', flexShrink: 0 }}>DEBUG · COND</span>
        {CONDITIONS.map(c => (
          <button key={c}
            style={conditionOverride === c ? btnActive : btnBase}
            onClick={() => onCondition(conditionOverride === c ? null : c)}>
            {c}
          </button>
        ))}
        <span className="text-[10px] ml-1" style={{ color: 'var(--ink-faint)' }}>
          actual: {actualCondition}
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
interface Props { title: string }

export default function WeatherDashboard({ title }: Props) {
  const t = useTranslations('weather');
  const isDark = useIsDark();

  const [latest, setLatest] = useState<WeatherReading | null>(null);
  const [cloudForecast, setCloudForecast] = useState<MeteoblueForecastEntry[]>([]);
  const [cwaForecast, setCwaForecast] = useState<CwaForecastPeriod[]>([]);
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [chartHours, setChartHours] = useState(12);
  const [loading, setLoading] = useState(true);
  const [fetchTime, setFetchTime] = useState<Date | null>(null);
  const [bg, setBg] = useState('');

  const [simMinutes, setSimMinutes] = useState<number | null>(null);
  const [debugCondition, setDebugCondition] = useState<string | null>(null);

  const fetchLatest = async () => {
    try {
      const res = await fetch('/api/weather/latest');
      if (res.ok) {
        const data = await res.json() as WeatherReading;
        // startTransition marks this as a low-priority update so React yields
        // to the browser between reconciliation chunks, keeping animations smooth.
        startTransition(() => {
          setLatest(data);
          setFetchTime(new Date());
          setLoading(false);
        });
      }
    } catch { /* silent */ }
  };

  const fetchCwa = async () => {
    try {
      const res = await fetch('/api/weather/forecast/cwa');
      if (res.ok) {
        const data = await res.json() as { forecast: CwaForecastPeriod[] };
        startTransition(() => { setCwaForecast(data.forecast ?? []); });
      }
    } catch { /* silent */ }
  };

  const fetchCloud = async () => {
    try {
      const res = await fetch('/api/weather/forecast/cloud');
      if (res.ok) {
        const data = await res.json() as MeteoblueForecastEntry[];
        startTransition(() => { setCloudForecast(data); });
      }
    } catch { /* silent */ }
  };

  const fetchChart = async (hours: number) => {
    try {
      const res = await fetch(`/api/weather/chart?hours=${hours}`);
      if (res.ok) {
        const data = await res.json() as ChartRow[];
        startTransition(() => { setChartData(data); });
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchLatest(); fetchCwa(); fetchCloud(); fetchChart(chartHours);
    const li = setInterval(fetchLatest, REFRESH_MS);
    const ci = setInterval(fetchCwa, CWA_REFRESH_MS);
    return () => { clearInterval(li); clearInterval(ci); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchChart(chartHours); }, [chartHours]);

  // Update background every 30 s on real clock; immediately when slider/theme changes.
  // Always pass dark=true so the sky uses the subdued L×0.42 palette in both modes —
  // the weather page is always sky-mode with white text, so a bright light-mode sky
  // would wash out legibility.
  useEffect(() => {
    setBg(computeBackground(latest, cloudForecast, true, simMinutes, debugCondition));
    if (simMinutes !== null) return; // slider drives updates manually
    const timer = setInterval(
      () => setBg(computeBackground(latest, cloudForecast, true, null, debugCondition)),
      30_000,
    );
    return () => clearInterval(timer);
  }, [latest, cloudForecast, simMinutes, debugCondition]);

  // Push sky onto body so it shows through the transparent navbar & footer.
  // The CSS gradient (`bg`) serves as a WebGL fallback — AtmosphereCanvas
  // renders on top of it (z-index: -1 is above the body background layer)
  // and replaces it visually whenever WebGL is available.
  useEffect(() => {
    if (!bg) return;
    document.body.style.background = bg;
    document.body.style.backgroundAttachment = 'fixed';

    const main    = document.querySelector('main')    as HTMLElement | null;
    const footer  = document.querySelector('footer')  as HTMLElement | null;
    const wrapper = main?.parentElement               as HTMLElement | null;
    if (wrapper) wrapper.style.background = 'transparent';
    if (main)    main.style.background    = 'transparent';
    if (footer) {
      footer.style.background        = 'transparent';
      footer.style.backdropFilter    = 'none';
      (footer.style as CSSStyleDeclaration & { webkitBackdropFilter: string }).webkitBackdropFilter = 'none';
      footer.style.borderTopColor    = 'rgba(255,255,255,0.12)';
    }

    return () => {
      document.body.style.background = '';
      document.body.style.backgroundAttachment = '';
      if (wrapper) wrapper.style.background = '';
      if (main)    main.style.background    = '';
      if (footer) {
        footer.style.background           = '';
        footer.style.backdropFilter       = '';
        (footer.style as CSSStyleDeclaration & { webkitBackdropFilter: string }).webkitBackdropFilter = '';
        footer.style.borderTopColor       = '';
      }
    };
  }, [bg]);

  // Sky-mode: override all CSS colour vars to white-on-sky (Apple Weather style).
  // Runs once on mount; cleanup restores normal theme when leaving the page.
  useEffect(() => {
    const root = document.documentElement;
    const overrides: [string, string][] = [
      ['--ink',           'rgba(255,255,255,0.95)'],
      ['--ink-secondary', 'rgba(255,255,255,0.75)'],
      ['--ink-muted',     'rgba(255,255,255,0.55)'],
      ['--ink-faint',     'rgba(255,255,255,0.38)'],
      ['--line',          'rgba(255,255,255,0.12)'],
      ['--line-dark',     'rgba(255,255,255,0.20)'],
      ['--bg-muted',      'rgba(255,255,255,0.07)'],
      ['--bg-warm',       'rgba(255,255,255,0.05)'],
      ['--accent',        'rgba(255,255,255,0.90)'],
      // Fully transparent so the sky gradient flows through navbar & footer unobstructed.
      // backdrop-filter blur alone provides the frosted-glass separation.
      ['--nav-bg',        'rgba(0,0,0,0)'],
      ['--nav-border',    'rgba(255,255,255,0.12)'],
      // Card shape & depth — scoped to the weather page only.
      ['--card-radius',   '20px'],
      ['--card-shadow',   '0 4px 32px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.18)'],
    ];
    overrides.forEach(([k, v]) => root.style.setProperty(k, v));
    return () => overrides.forEach(([k]) => root.style.removeProperty(k));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lastUpdate = fetchTime
    ? fetchTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const now = new Date();
  const actualMinutes = now.getHours() * 60 + now.getMinutes();

  let riseMin = 6 * 60, setMin = 18 * 60;
  if (latest?.sunrise) { const [h, m] = latest.sunrise.split(':').map(Number); riseMin = (h ?? 6) * 60 + (m ?? 0); }
  if (latest?.sunset)  { const [h, m] = latest.sunset.split(':').map(Number);  setMin  = (h ?? 18) * 60 + (m ?? 0); }

  const period = getTimePeriod(simMinutes ?? actualMinutes, riseMin, setMin);
  const condition = conditionKey(latest, cloudForecast);
  const conditionLabel = t(`conditions.${condition}`);

  // Physical atmosphere: derive sun position from today's solar arc
  const currentMinForSun = simMinutes ?? actualMinutes;
  const { elevation: sunElevation, azimuth: sunAzimuth } =
    computeSunPosition(currentMinForSun, riseMin, setMin);
  const atmosphereCondition = (debugCondition ?? condition) as AtmosphereCondition;
  const cloudForceDark = true; // weather page is always sky-mode (white text)

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--ink-muted)' }}>
          {t('lastUpdate')}…
        </span>
      </div>
    );
  }

  // Matte frosted-glass cards — slightly more opaque and less saturated than
  // a "crystal clear" glass gives a softer, more premium feel against the sky.
  const cardBg     = 'rgba(255,255,255,0.11)';
  const cardBorder = 'rgba(255,255,255,0.16)';
  const cardGlass  = 'blur(28px) saturate(140%)';

  return (
    <div
      className="page-enter"
      style={{
        // Inject glass variables for all descendant .card and InstrumentPanel
        '--card-bg':     cardBg,
        '--card-border': cardBorder,
        '--card-glass':  cardGlass,
      } as React.CSSProperties}
    >
      {/* Physically-based sky — renders via WebGL portal into document.body.
          Falls back to the CSS gradient on body when WebGL is unavailable. */}
      <AtmosphereCanvas
        sunElevation={sunElevation}
        sunAzimuth={sunAzimuth}
        condition={atmosphereCondition}
      />
      {/* Overcast veil + rain streaks — z-index 0, between sky (-1) and content (1) */}
      <RainCanvas condition={atmosphereCondition} sunElevation={sunElevation} />

      {/* z-index: 1 lifts all page content above the rain canvas (z: 0) */}
      <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="max-w-screen-xl mx-auto px-4 pt-8 pb-16">

        {/* ── Header ── */}
        <div className="mb-6 pb-5 flex items-end justify-between"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.18)' }}>
          <div>
            <p className="label mb-3">NTHU Observatory</p>
            <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
              {title}
            </h1>
          </div>
          <div className="text-right pb-0.5 space-y-0.5">
            <p className="text-[10px]" style={{ color: 'var(--ink-faint)', letterSpacing: '0.05em' }}>
              24°47′39″N · 120°59′31″E · EL 70 m
            </p>
            <p className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
              {Math.round(ALLSKY_REFRESH_INTERVAL_MS / 1000)}s refresh · Updated {lastUpdate}
            </p>
          </div>
        </div>

        <div className="space-y-3">

          {/* ── Row 1: 4-col grid, 2 implicit rows ── */}
          {/*   row-a: InstrumentPanel (col 1-3)  |  AllSkyCamera (col 4)        */}
          {/*   row-b: WindCard (col 1) | RainCard (col 2) | SunMoonCard (col 3) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-stretch">
            {/* InstrumentPanel spans cols 1-3, row 1 */}
            <div className="md:col-span-3">
              <InstrumentPanel
                reading={latest}
                condition={conditionLabel}
                conditionKey={condition}
                isNight={period === 'night'}
              />
            </div>
            {/* AllSkyCamera spans col 4, rows 1-2 */}
            <div className="md:row-span-2 flex flex-col" style={{ minHeight: 0 }}>
              <div className="flex-1 min-h-0">
                <AllSkyCamera />
              </div>
            </div>
            {/* Wind, Rain, SunMoon in row 2 cols 1-3 */}
            <WindCard reading={latest} />
            <RainCard reading={latest} />
            <SunMoonCard reading={latest} />
          </div>

          {/* ── Row 2: History chart (full width) ── */}
          <WeatherChart
            data={chartData}
            hours={chartHours}
            onHoursChange={h => setChartHours(h)}
            sunrise={latest?.sunrise}
            sunset={latest?.sunset}
          />

          {/* ── Row 3: CWA Forecast (full width) ── */}
          <CwaForecastCard periods={cwaForecast} />

          {/* ── Cloud & Seeing forecast ── */}
          {cloudForecast.length > 0 && (
            <CloudSeeingGrid
              forecast={cloudForecast}
              stationDate={latest?.stationDate ?? ''}
              stationTime={latest?.stationTime ?? ''}
              forceDark={cloudForceDark}
            />
          )}

          {/* ── 5-day meteogram ── */}
          <MeteogramEmbed />

          <DebugPanel
            simMinutes={simMinutes}
            conditionOverride={debugCondition}
            actualMinutes={actualMinutes}
            actualCondition={condition}
            sunrise={latest?.sunrise ?? ''}
            sunset={latest?.sunset ?? ''}
            onSimMinutes={setSimMinutes}
            onCondition={setDebugCondition}
          />
        </div>
      </div>
      </div> {/* end z-index: 1 content wrapper */}
    </div>
  );
}
