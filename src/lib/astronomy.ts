import * as Astronomy from 'astronomy-engine';

// NTHU Observatory, Hsinchu, Taiwan
export const NTHU_OBSERVER = new Astronomy.Observer(24.7964, 120.9965, 100);

export const PLANETS = [
  { name: 'Mercury', body: Astronomy.Body.Mercury },
  { name: 'Venus',   body: Astronomy.Body.Venus },
  { name: 'Mars',    body: Astronomy.Body.Mars },
  { name: 'Jupiter', body: Astronomy.Body.Jupiter },
  { name: 'Saturn',  body: Astronomy.Body.Saturn },
  { name: 'Uranus',  body: Astronomy.Body.Uranus },
  { name: 'Neptune', body: Astronomy.Body.Neptune },
];

export interface NightWindow {
  start: Date;  // astronomical dusk
  end: Date;    // astronomical dawn
}

export type MoonPhaseKey =
  | 'moonNew' | 'moonWaxingCrescent' | 'moonFirstQuarter' | 'moonWaxingGibbous'
  | 'moonFull' | 'moonWaningGibbous' | 'moonLastQuarter' | 'moonWaningCrescent';

export interface MoonInfo {
  phase: number;
  illumination: number;
  phaseKey: MoonPhaseKey;
  riseTime: Date | null;
  setTime: Date | null;
}

export interface PlanetInfo {
  name: string;
  currentAlt: number;
  currentRising: boolean;
  peakAlt: number;       // peak during dark hours
  riseTime: Date | null;
  setTime: Date | null;
  transitTime: Date | null;
  visible: boolean;      // peak > 10°
  magnitude: number;
}

export interface DsoVisibility {
  currentAlt: number;
  currentRising: boolean;
  maxAltitude: number;
  transitTime: Date | null;
  visible: boolean;      // maxAltitude > 20°
}

export function getNightWindow(date: Date): NightWindow {
  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);

  const dusk = Astronomy.SearchAltitude(
    Astronomy.Body.Sun, NTHU_OBSERVER, -1, noon, 1, -18
  );
  const dawn = Astronomy.SearchAltitude(
    Astronomy.Body.Sun, NTHU_OBSERVER, +1, dusk ? dusk.date : noon, 12, -18
  );

  return {
    start: dusk ? dusk.date : noon,
    end:   dawn ? dawn.date : new Date(noon.getTime() + 12 * 3600_000),
  };
}

export function getMoonInfo(date: Date): MoonInfo {
  const phase = Astronomy.MoonPhase(date);
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);
  const midnight = new Date(date); midnight.setHours(0, 0, 0, 0);

  let riseTime: Date | null = null;
  let setTime:  Date | null = null;
  try {
    const rise = Astronomy.SearchRiseSet(Astronomy.Body.Moon, NTHU_OBSERVER, +1, midnight, 1);
    const set  = Astronomy.SearchRiseSet(Astronomy.Body.Moon, NTHU_OBSERVER, -1, midnight, 1);
    riseTime = rise ? rise.date : null;
    setTime  = set  ? set.date  : null;
  } catch { /* circumpolar or never rises */ }

  let phaseKey: MoonPhaseKey;
  if (phase < 22.5 || phase >= 337.5)  phaseKey = 'moonNew';
  else if (phase < 67.5)               phaseKey = 'moonWaxingCrescent';
  else if (phase < 112.5)              phaseKey = 'moonFirstQuarter';
  else if (phase < 157.5)              phaseKey = 'moonWaxingGibbous';
  else if (phase < 202.5)              phaseKey = 'moonFull';
  else if (phase < 247.5)              phaseKey = 'moonWaningGibbous';
  else if (phase < 292.5)              phaseKey = 'moonLastQuarter';
  else                                 phaseKey = 'moonWaningCrescent';

  return { phase, illumination: illum.phase_fraction, phaseKey, riseTime, setTime };
}

function altAzAt(body: Astronomy.Body, time: Date): { altitude: number; azimuth: number } {
  const eq = Astronomy.Equator(body, time, NTHU_OBSERVER, true, true);
  const hz = Astronomy.Horizon(time, NTHU_OBSERVER, eq.ra, eq.dec, 'normal');
  return { altitude: hz.altitude, azimuth: hz.azimuth };
}

export function getPlanetInfo(body: Astronomy.Body, name: string, night: NightWindow, now: Date): PlanetInfo {
  const midnight = new Date(night.start); midnight.setHours(0, 0, 0, 0);
  let riseTime: Date | null = null;
  let setTime:  Date | null = null;
  let transitTime: Date | null = null;

  try {
    const rise    = Astronomy.SearchRiseSet(body, NTHU_OBSERVER, +1, midnight, 1);
    const set     = Astronomy.SearchRiseSet(body, NTHU_OBSERVER, -1, midnight, 1);
    const transit = Astronomy.SearchHourAngle(body, NTHU_OBSERVER, 0, midnight, +1);
    riseTime    = rise    ? rise.date         : null;
    setTime     = set     ? set.date          : null;
    transitTime = transit ? transit.time.date : null;
  } catch { /* ignore */ }

  // Current altitude + rising/setting
  const cur  = altAzAt(body, now);
  const cur2 = altAzAt(body, new Date(now.getTime() + 10 * 60_000));
  const currentAlt     = cur.altitude;
  const currentRising  = cur2.altitude > cur.altitude;

  // Peak altitude during dark hours
  let peakAlt = -90;
  const steps = Math.ceil((night.end.getTime() - night.start.getTime()) / (30 * 60_000));
  for (let i = 0; i <= steps; i++) {
    const t = new Date(night.start.getTime() + i * 30 * 60_000);
    const hz = altAzAt(body, t);
    if (hz.altitude > peakAlt) peakAlt = hz.altitude;
  }

  const illum = Astronomy.Illumination(body, now);

  return {
    name, currentAlt, currentRising, peakAlt,
    riseTime, setTime, transitTime,
    visible: peakAlt > 10,
    magnitude: illum.mag,
  };
}

export function getDsoVisibility(ra: number, dec: number, night: NightWindow, now: Date): DsoVisibility {
  // Current alt
  const hzNow  = Astronomy.Horizon(now, NTHU_OBSERVER, ra / 15, dec, 'normal');
  const hzNext = Astronomy.Horizon(
    new Date(now.getTime() + 10 * 60_000), NTHU_OBSERVER, ra / 15, dec, 'normal'
  );
  const currentAlt    = hzNow.altitude;
  const currentRising = hzNext.altitude > hzNow.altitude;

  // Peak during dark hours
  let maxAlt = -90;
  let transitTime: Date | null = null;
  const steps = Math.ceil((night.end.getTime() - night.start.getTime()) / (30 * 60_000));
  for (let i = 0; i <= steps; i++) {
    const t = new Date(night.start.getTime() + i * 30 * 60_000);
    const hz = Astronomy.Horizon(t, NTHU_OBSERVER, ra / 15, dec, 'normal');
    if (hz.altitude > maxAlt) { maxAlt = hz.altitude; transitTime = t; }
  }

  return { currentAlt, currentRising, maxAltitude: maxAlt, transitTime, visible: maxAlt > 20 };
}

export function thumbnailUrl(ra: number, dec: number, sizeDeg: number): string {
  const fov = Math.max(0.1, Math.min(sizeDeg * 2.5, 5));
  return `/api/dso-thumbnail?ra=${ra.toFixed(4)}&dec=${dec.toFixed(4)}&fov=${fov.toFixed(3)}`;
}

export function formatTime(date: Date | null, locale: string): string {
  if (!date) return '—';
  return date.toLocaleTimeString(locale === 'tw' ? 'zh-TW' : 'en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
