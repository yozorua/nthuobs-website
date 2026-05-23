'use client';

/**
 * StarCanvas — real-time star field using Yale BSC5 (9,001 stars).
 *
 * Coordinate pipeline each LST update (every 30 s):
 *   RA/Dec (J2000) → Hour Angle → Altitude/Azimuth → canvas (x, y)
 *
 * The projection matches AtmosphereCanvas exactly: equidistant angular,
 * HALF_VFOV = 0.65 rad, view centred on south (NTHU, 24.80°N 120.99°E).
 *
 * Layer order (z-index):
 *   AtmosphereCanvas  z: -1   (WebGL sky)
 *   StarCanvas        z: -1   (DOM-ordered after atmosphere, so on top)
 *   RainCanvas        z:  0   (overcast + rain)
 *   page content      z:  1
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AtmosphereCondition } from './AtmosphereCanvas';

// ── Constants — must match AtmosphereCanvas shader ────────────────────────────

const HALF_VFOV   = 0.65;                     // half vertical field of view (radians)
const LAT_RAD     = 24.80 * (Math.PI / 180);  // NTHU Observatory latitude
const LON_DEG     = 120.99;                   // NTHU longitude (east)
const D2R         = Math.PI / 180;

const FRAME_MS           = 1000 / 60;
const LERP               = 0.03;
const LST_UPDATE_MS      = 30_000;   // recompute positions every 30 s (stars barely move)
const SHOOT_INTERVAL_MIN = 9_000;
const SHOOT_INTERVAL_MAX = 28_000;
const SHOOT_SPEED        = 18;       // px/frame
const SHOOT_TAIL         = 160;      // px
const CLOUD_COUNT        = 7;
const CLOUD_SPEED        = 0.00010; // normalized units / frame

// ── Types ─────────────────────────────────────────────────────────────────────

interface Star {
  ra: number; dec: number; vmag: number;
  r: number; g: number; b: number;   // 0–255 blackbody RGB
  size: number;
  baseAlpha: number;
  twinklePhase: number;
  twinkleSpeed: number;
  twinkleAmp: number;
  px: number; py: number;  // cached canvas position (updated every LST_UPDATE_MS)
  visible: boolean;
}

interface ShootingStar {
  x: number; y: number;
  vx: number; vy: number;
  traveled: number; totalDist: number; alpha: number;
}

interface CloudPatch {
  nx: number; ny: number; nrx: number; nry: number; vnx: number; alpha: number;
}

// ── Colour temperature → RGB (Tanner Helland's algorithm) ────────────────────

function kelvinToRGB(K: number): [number, number, number] {
  const t = Math.max(1000, Math.min(40000, K)) / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(t) - 161.1195681661));
    b = t <= 19 ? 0 : Math.min(255, Math.max(0, 138.5177312231 * Math.log(t - 10) - 305.0447927307));
  } else {
    r = Math.min(255, Math.max(0, 329.698727446 * Math.pow(t - 60, -0.1332047592)));
    g = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(t - 60, -0.0755148492)));
    b = 255;
  }
  return [Math.round(r), Math.round(g), Math.round(b)];
}

// ── Visual magnitude → radius + base alpha (non-linear perceptual scale) ─────

function magToProps(vmag: number): { size: number; baseAlpha: number } {
  const brightness = Math.max(0, (6.5 - vmag) / 8.0);  // 0 (faint) → ~1 (Sirius)
  return {
    size:      0.4 + Math.pow(brightness, 1.35) * 2.9,
    baseAlpha: 0.30 + brightness * 0.70,
  };
}

// ── LST (Local Sidereal Time) in radians ─────────────────────────────────────

function computeLSTrad(date: Date): number {
  const JD   = date.getTime() / 86_400_000 + 2_440_587.5;
  const T    = (JD - 2_451_545.0) / 36_525;
  let GMST   = 280.46061837
               + 360.98564736629 * (JD - 2_451_545.0)
               + 0.000387933 * T * T
               - T * T * T / 38_710_000;
  GMST = ((GMST % 360) + 360) % 360;
  return ((GMST + LON_DEG) % 360 + 360) % 360 * D2R;
}

// ── RA/Dec → canvas (x, y) via equidistant-angular projection ────────────────
//
// Matches the AtmosphereCanvas GLSL shader exactly:
//   thetaV = elevation,  thetaH = azimuth-from-south
//   screen_x = thetaH / (HALF_VFOV × aspect)      ∈ [−1, +1]
//   screen_y = thetaV / HALF_VFOV − 1             ∈ [−1, +1]  (WebGL convention)
//
// Canvas pixels:  x = (screen_x + 1)/2 × W
//                 y = (1 − screen_y)/2 × H   (y inverted: 0 = top)

function projectStar(
  ra: number, dec: number,
  lstRad: number,
  W: number, H: number,
): { px: number; py: number; visible: boolean } {
  const H_ = lstRad - ra;                           // hour angle

  const sinAlt =
    Math.sin(LAT_RAD) * Math.sin(dec) +
    Math.cos(LAT_RAD) * Math.cos(dec) * Math.cos(H_);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  if (alt <= 0) return { px: 0, py: 0, visible: false };   // below horizon

  const aspect = W / H;

  // Azimuth from south (0=S, +π/2=W, -π/2=E) — Meeus, Astronomical Algorithms §13
  const azFromSouth = Math.atan2(
    Math.sin(H_) * Math.cos(dec),
    Math.cos(H_) * Math.sin(LAT_RAD) * Math.cos(dec) - Math.sin(dec) * Math.cos(LAT_RAD),
  );

  const nx = azFromSouth / (HALF_VFOV * aspect);   // −1 = left edge, +1 = right edge
  if (nx < -1 || nx > 1) return { px: 0, py: 0, visible: false };

  const altFrac = alt / (2 * HALF_VFOV);           // 0 = horizon, 1 = top of FOV
  if (altFrac > 1) return { px: 0, py: 0, visible: false };

  return {
    px:      (nx + 1) / 2 * W,
    py:      (1 - altFrac) * H,
    visible: true,
  };
}

// ── Night factor: 0 (day) → 1 (full night past civil twilight) ───────────────

function nightFactor(sunElevation: number): number {
  const DARK = -0.105; const LIGHT = 0.0;
  if (sunElevation <= DARK)  return 1;
  if (sunElevation >= LIGHT) return 0;
  const t = (LIGHT - sunElevation) / (LIGHT - DARK);
  return t * t * (3 - 2 * t);
}

function conditionStarAlpha(cond: AtmosphereCondition): number {
  switch (cond) {
    case 'Clear':        return 1.00;
    case 'Windy':        return 0.95;
    case 'PartlyCloudy': return 0.55;
    case 'Cloudy':       return 0.00;
    case 'Rainy':        return 0.00;
    default:             return 0.85;
  }
}

function rand(lo: number, hi: number) { return lo + Math.random() * (hi - lo); }

function makeCloudPatches(): CloudPatch[] {
  return Array.from({ length: CLOUD_COUNT }, () => ({
    nx:  Math.random(),
    ny:  Math.random() * 0.85,
    nrx: rand(0.08, 0.24),
    nry: rand(0.04, 0.12),
    vnx: (Math.random() < 0.5 ? 1 : -1) * rand(CLOUD_SPEED * 0.5, CLOUD_SPEED * 1.5),
    alpha: rand(0.5, 0.85),
  }));
}

function makeShootingStar(W: number, H: number): ShootingStar {
  const angle = rand(-0.6, 0.6) + Math.PI * 0.22;
  return {
    x: rand(W * 0.1, W * 0.9),
    y: rand(H * 0.02, H * 0.45),
    vx: Math.cos(angle) * SHOOT_SPEED,
    vy: Math.sin(angle) * SHOOT_SPEED,
    traveled: 0,
    totalDist: rand(SHOOT_TAIL * 2, SHOOT_TAIL * 4.5),
    alpha: 1,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  condition:    AtmosphereCondition;
  sunElevation: number;
  /** Simulated time from the debug slider; null = use real clock. */
  simDate?:     Date | null;
}

export default function StarCanvas({ condition, sunElevation, simDate }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const condRef      = useRef(condition);
  const sunRef       = useRef(sunElevation);
  const simDateRef   = useRef(simDate);
  const starsRef     = useRef<Star[]>([]);
  const cloudsRef    = useRef<CloudPatch[]>(makeCloudPatches());
  const shootingRef  = useRef<ShootingStar | null>(null);
  const rafRef       = useRef<number>(0);
  const globalAlpha  = useRef(0);
  const nextShootMs  = useRef(0);
  const lastLSTms    = useRef(0);   // rAF timestamp of last position update

  useEffect(() => { condRef.current    = condition;    }, [condition]);
  useEffect(() => { sunRef.current     = sunElevation; }, [sunElevation]);
  useEffect(() => {
    simDateRef.current = simDate ?? null;
    lastLSTms.current  = 0; // force immediate reproject when sim time changes
  }, [simDate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Load catalog ───────────────────────────────────────────────────────
    let mounted = true;
    fetch('/data/stars.json')
      .then(r => r.json() as Promise<[number, number, number, number][]>)
      .then(entries => {
        if (!mounted) return;
        const stars: Star[] = entries.map(([ra, dec, vmag, kelvin]) => {
          const [r, g, b] = kelvinToRGB(kelvin);
          const { size, baseAlpha } = magToProps(vmag);
          return {
            ra, dec, vmag, r, g, b, size, baseAlpha,
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: rand(0.015, 0.055),
            twinkleAmp:   vmag > 4 ? rand(0.10, 0.30) : rand(0.05, 0.18),  // brighter stars twinkle less
            px: 0, py: 0, visible: false,
          };
        });
        starsRef.current = stars;
        lastLSTms.current = 0; // force immediate position update on next frame
      })
      .catch(() => { /* silent — random fallback stars would show nothing */ });

    // ── Resize ────────────────────────────────────────────────────────────
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      lastLSTms.current = 0; // reproject on resize
    };
    resize();
    window.addEventListener('resize', resize);

    // ── rAF loop ──────────────────────────────────────────────────────────
    let lastTs = 0;

    const draw = (ts: number) => {
      const dt   = lastTs > 0 ? Math.min((ts - lastTs) / FRAME_MS, 4) : 1;
      lastTs     = ts;

      const cond = condRef.current;
      const elev = sunRef.current;
      const W    = canvas.width;
      const H    = canvas.height;
      const stars = starsRef.current;

      // Global lerped alpha
      const target = nightFactor(elev) * conditionStarAlpha(cond);
      globalAlpha.current += (target - globalAlpha.current) * LERP * dt;
      const gA = globalAlpha.current;

      ctx.clearRect(0, 0, W, H);

      if (gA < 0.005 || stars.length === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // ── Reproject when LST has advanced enough ─────────────────────────
      if (ts - lastLSTms.current > LST_UPDATE_MS || lastLSTms.current === 0) {
        const lstRad = computeLSTrad(simDateRef.current ?? new Date());
        for (const s of stars) {
          const pos = projectStar(s.ra, s.dec, lstRad, W, H);
          s.px = pos.px; s.py = pos.py; s.visible = pos.visible;
        }
        lastLSTms.current = ts;
      }

      // ── Draw stars ────────────────────────────────────────────────────
      for (const s of stars) {
        if (!s.visible) continue;

        s.twinklePhase += s.twinkleSpeed * dt;
        const twinkle = 1 - s.twinkleAmp * (0.5 + 0.5 * Math.sin(s.twinklePhase));
        const alpha   = gA * s.baseAlpha * twinkle;
        if (alpha < 0.01) continue;

        // Core dot
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = `rgb(${s.r},${s.g},${s.b})`;
        ctx.beginPath();
        ctx.arc(s.px, s.py, s.size * 0.60, 0, Math.PI * 2);
        ctx.fill();

        // Tight glow for brighter stars only — small radius, fast falloff
        if (s.size > 1.3) {
          const glowR = s.size * 2.0;
          const grad  = ctx.createRadialGradient(s.px, s.py, 0, s.px, s.py, glowR);
          grad.addColorStop(0,   `rgba(${s.r},${s.g},${s.b},${(alpha * 0.35).toFixed(3)})`);
          grad.addColorStop(0.4, `rgba(${s.r},${s.g},${s.b},${(alpha * 0.10).toFixed(3)})`);
          grad.addColorStop(1,   'rgba(0,0,0,0)');
          ctx.globalAlpha = 1;
          ctx.fillStyle   = grad;
          ctx.beginPath();
          ctx.arc(s.px, s.py, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // ── Cloud patches (PartlyCloudy) ──────────────────────────────────
      if (cond === 'PartlyCloudy' && gA > 0.05) {
        for (const c of cloudsRef.current) {
          c.nx += c.vnx * dt;
          if (c.nx < -c.nrx)    c.nx = 1 + c.nrx;
          if (c.nx > 1 + c.nrx) c.nx = -c.nrx;
          const cx = c.nx * W, cy = c.ny * H;
          const rx = c.nrx * W, ry = c.nry * H;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
          grad.addColorStop(0,    `rgba(0,0,0,${(c.alpha * gA).toFixed(3)})`);
          grad.addColorStop(0.65, `rgba(0,0,0,${(c.alpha * gA * 0.5).toFixed(3)})`);
          grad.addColorStop(1,    'rgba(0,0,0,0)');
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(1, ry / rx);
          ctx.beginPath();
          ctx.arc(0, 0, rx, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.restore();
        }
      }

      // ── Shooting star ─────────────────────────────────────────────────
      if (cond === 'Clear' || cond === 'Windy') {
        if (nextShootMs.current === 0)
          nextShootMs.current = ts + rand(SHOOT_INTERVAL_MIN, SHOOT_INTERVAL_MAX);

        if (ts >= nextShootMs.current && !shootingRef.current && gA > 0.5) {
          shootingRef.current = makeShootingStar(W, H);
          nextShootMs.current = ts + rand(SHOOT_INTERVAL_MIN, SHOOT_INTERVAL_MAX);
        }

        const ss = shootingRef.current;
        if (ss) {
          ss.x += ss.vx * dt;
          ss.y += ss.vy * dt;
          ss.traveled += SHOOT_SPEED * dt;

          const fadeStart = ss.totalDist * 0.65;
          if (ss.traveled > fadeStart)
            ss.alpha = Math.max(0, 1 - (ss.traveled - fadeStart) / (ss.totalDist - fadeStart));

          if (ss.traveled < ss.totalDist && ss.alpha > 0.01) {
            const tail = Math.min(ss.traveled, SHOOT_TAIL);
            const tx   = ss.x - ss.vx / SHOOT_SPEED * tail;
            const ty   = ss.y - ss.vy / SHOOT_SPEED * tail;
            const grad = ctx.createLinearGradient(tx, ty, ss.x, ss.y);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(1, `rgba(255,255,255,${(ss.alpha * gA).toFixed(3)})`);
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(ss.x, ss.y);
            ctx.strokeStyle = grad;
            ctx.lineWidth   = 1.5;
            ctx.lineCap     = 'round';
            ctx.stroke();
            ctx.globalAlpha = ss.alpha * gA;
            ctx.fillStyle   = 'white';
            ctx.beginPath();
            ctx.arc(ss.x, ss.y, 1.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          } else {
            shootingRef.current = null;
          }
        }
      } else {
        shootingRef.current = null;
        nextShootMs.current = 0;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      mounted = false;
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position:      'fixed',
        inset:         0,
        width:         '100%',
        height:        '100%',
        zIndex:        -1,
        pointerEvents: 'none',
        display:       'block',
      }}
    />,
    document.body,
  );
}
