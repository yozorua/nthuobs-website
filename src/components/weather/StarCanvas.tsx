'use client';

/**
 * StarCanvas — realistic night sky with twinkling stars, shooting stars,
 * and condition-aware cloud patches.
 *
 * Layer order (z-index):
 *   AtmosphereCanvas  z: -1   (WebGL sky, fixed)
 *   StarCanvas        z: -1   (this file — DOM-ordered after, so visually on top of atmosphere)
 *   RainCanvas        z:  0   (overcast + rain)
 *   page content      z:  1
 *
 * Stars are rendered in normalized (0–1) screen space and reprojected each
 * frame, so they stay fixed to the viewport regardless of scroll — exactly
 * what you want for a sky background.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AtmosphereCondition } from './AtmosphereCanvas';

// ── Tunables ──────────────────────────────────────────────────────────────────

const STAR_COUNT = 350;
const FRAME_MS   = 1000 / 60;
const LERP       = 0.03; // global alpha lerp speed

// Shooting stars
const SHOOT_INTERVAL_MIN = 9_000;  // ms between shots
const SHOOT_INTERVAL_MAX = 28_000;
const SHOOT_SPEED        = 18;     // px / frame
const SHOOT_TAIL         = 160;    // max tail length px

// Cloud patches (PartlyCloudy night)
const CLOUD_COUNT       = 7;
const CLOUD_SPEED_MIN   = 0.00005; // normalized/frame
const CLOUD_SPEED_MAX   = 0.00015;
const CLOUD_ALPHA       = 0.85;    // max opacity of dark cloud blobs

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Star {
  nx: number;     // 0–1 normalized x
  ny: number;     // 0–1 normalized y
  size: number;   // base radius px (at 1×)
  baseAlpha: number;
  twinklePhase: number;
  twinkleSpeed: number; // rad / frame
  twinkleAmp: number;
  // Color temperature — mostly blue-white, occasional warm
  r: number; g: number; b: number;
}

interface ShootingStar {
  x: number; y: number;   // viewport px, start
  vx: number; vy: number; // velocity px/frame
  traveled: number;       // px traveled so far
  totalDist: number;      // px before fade-out
  alpha: number;
}

interface CloudPatch {
  nx: number; ny: number; // center, normalized
  nrx: number; nry: number; // radii, normalized
  vnx: number;              // drift speed (normalized/frame)
  alpha: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Stars fade in when sun is below horizon; fully visible past civil twilight. */
function nightFactor(sunElevation: number): number {
  const FULL_NIGHT = -0.105; // ≈ −6° civil twilight end
  const HORIZON    =  0.0;
  if (sunElevation <= FULL_NIGHT) return 1;
  if (sunElevation >= HORIZON)    return 0;
  const t = (HORIZON - sunElevation) / (HORIZON - FULL_NIGHT);
  return t * t * (3 - 2 * t); // smoothstep
}

/** Maximum star opacity based on weather — clouds hide stars. */
function conditionStarAlpha(cond: AtmosphereCondition): number {
  switch (cond) {
    case 'Clear':        return 1.00;
    case 'Windy':        return 0.95;
    case 'PartlyCloudy': return 0.55; // cloud patches handle the rest
    case 'Cloudy':       return 0.00;
    case 'Rainy':        return 0.00;
    default:             return 0.85;
  }
}

/** Show cloud patches only for PartlyCloudy at night. */
function showClouds(cond: AtmosphereCondition): boolean {
  return cond === 'PartlyCloudy';
}

function rand(lo: number, hi: number) { return lo + Math.random() * (hi - lo); }

function makeStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, (): Star => {
    // Vary size with a power distribution: most stars tiny, a few prominent
    const tier = Math.random();
    let size: number;
    if (tier < 0.75) size = rand(0.4, 1.0);       // dim background stars
    else if (tier < 0.93) size = rand(1.0, 1.7);   // mid-range
    else size = rand(1.7, 2.8);                     // bright foreground stars

    // Color temperature: blue-white (hot) to slightly warm (cooler)
    const colorRoll = Math.random();
    let r = 255, g = 255, b = 255;
    if (colorRoll < 0.55) {
      // Blue-white (O/B/A type)
      r = Math.round(rand(200, 240));
      g = Math.round(rand(215, 245));
      b = 255;
    } else if (colorRoll < 0.80) {
      // Pure white (F/G)
      r = g = b = 255;
    } else if (colorRoll < 0.95) {
      // Warm yellow (G/K)
      r = 255;
      g = Math.round(rand(235, 250));
      b = Math.round(rand(200, 230));
    } else {
      // Orange-red (M type / giants)
      r = 255;
      g = Math.round(rand(180, 220));
      b = Math.round(rand(140, 180));
    }

    return {
      nx: Math.random(),
      ny: Math.random() * 0.90, // keep mostly in upper 90% of sky
      size,
      baseAlpha: rand(0.55, 1.0),
      twinklePhase: rand(0, Math.PI * 2),
      twinkleSpeed: rand(0.015, 0.055),
      twinkleAmp:   rand(0.08, 0.30),
      r, g, b,
    };
  });
}

function makeCloudPatches(): CloudPatch[] {
  return Array.from({ length: CLOUD_COUNT }, (): CloudPatch => ({
    nx:  Math.random(),
    ny:  Math.random() * 0.85,
    nrx: rand(0.08, 0.24),
    nry: rand(0.04, 0.12),
    vnx: (Math.random() < 0.5 ? 1 : -1) * rand(CLOUD_SPEED_MIN, CLOUD_SPEED_MAX),
    alpha: rand(0.5, CLOUD_ALPHA),
  }));
}

function makeShootingStar(W: number, H: number): ShootingStar {
  // Spawn near top half of screen, moving downward at a shallow angle
  const angle = rand(-0.6, 0.6) + Math.PI * 0.22; // roughly top-right to bottom-left
  const x = rand(W * 0.1, W * 0.9);
  const y = rand(H * 0.02, H * 0.45);
  const speed = SHOOT_SPEED;
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    traveled: 0,
    totalDist: rand(SHOOT_TAIL * 2, SHOOT_TAIL * 4.5),
    alpha: 1,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  condition:    AtmosphereCondition;
  sunElevation: number; // radians; negative = below horizon (night)
}

export default function StarCanvas({ condition, sunElevation }: Props) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const conditionRef   = useRef(condition);
  const sunRef         = useRef(sunElevation);
  const starsRef       = useRef<Star[]>([]);
  const cloudsRef      = useRef<CloudPatch[]>([]);
  const shootingRef    = useRef<ShootingStar | null>(null);
  const rafRef         = useRef<number>(0);
  const globalAlpha    = useRef(0);  // current lerped alpha
  const nextShootMs    = useRef(0);  // rAF timestamp for next shooting star

  useEffect(() => { conditionRef.current = condition;    }, [condition]);
  useEffect(() => { sunRef.current       = sunElevation; }, [sunElevation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    starsRef.current  = makeStars();
    cloudsRef.current = makeCloudPatches();

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let lastTs = 0;

    const draw = (ts: number) => {
      const dt   = lastTs > 0 ? Math.min((ts - lastTs) / FRAME_MS, 4) : 1;
      lastTs     = ts;

      const cond = conditionRef.current;
      const elev = sunRef.current;
      const W    = canvas.width;
      const H    = canvas.height;

      // Global alpha = night-factor × condition-factor (lerped for smooth transitions)
      const target = nightFactor(elev) * conditionStarAlpha(cond);
      globalAlpha.current += (target - globalAlpha.current) * LERP * dt;
      const gA = globalAlpha.current;

      ctx.clearRect(0, 0, W, H);

      if (gA < 0.005) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // ── 1. Stars ──────────────────────────────────────────────────────────
      for (const s of starsRef.current) {
        s.twinklePhase += s.twinkleSpeed * dt;
        const twinkle = 1 - s.twinkleAmp * (0.5 + 0.5 * Math.sin(s.twinklePhase));
        const alpha   = gA * s.baseAlpha * twinkle;
        if (alpha < 0.01) continue;

        const px = s.nx * W;
        const py = s.ny * H;

        // Inner bright core
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = `rgb(${s.r},${s.g},${s.b})`;
        ctx.beginPath();
        ctx.arc(px, py, s.size * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Soft glow for brighter stars
        if (s.size > 1.2) {
          const glowR = s.size * 3.5;
          const grad  = ctx.createRadialGradient(px, py, 0, px, py, glowR);
          grad.addColorStop(0,   `rgba(${s.r},${s.g},${s.b},${(alpha * 0.35).toFixed(3)})`);
          grad.addColorStop(1,   'rgba(0,0,0,0)');
          ctx.globalAlpha = 1;
          ctx.fillStyle   = grad;
          ctx.beginPath();
          ctx.arc(px, py, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // ── 2. Cloud patches (PartlyCloudy) ──────────────────────────────────
      if (showClouds(cond) && gA > 0.05) {
        for (const c of cloudsRef.current) {
          // Drift
          c.nx += c.vnx * dt;
          if (c.nx < -c.nrx)     c.nx = 1 + c.nrx;
          if (c.nx > 1 + c.nrx)  c.nx = -c.nrx;

          const cx = c.nx * W;
          const cy = c.ny * H;
          const rx = c.nrx * W;
          const ry = c.nry * H;

          // Dark semi-transparent blob that covers stars beneath it
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

      // ── 3. Shooting star ─────────────────────────────────────────────────
      if (cond === 'Clear' || cond === 'Windy') {
        // Schedule next shooting star
        if (nextShootMs.current === 0) {
          nextShootMs.current = ts + rand(SHOOT_INTERVAL_MIN, SHOOT_INTERVAL_MAX);
        }
        if (ts >= nextShootMs.current && !shootingRef.current && gA > 0.5) {
          shootingRef.current = makeShootingStar(W, H);
          nextShootMs.current = ts + rand(SHOOT_INTERVAL_MIN, SHOOT_INTERVAL_MAX);
        }

        const ss = shootingRef.current;
        if (ss) {
          ss.x        += ss.vx * dt;
          ss.y        += ss.vy * dt;
          ss.traveled += SHOOT_SPEED * dt;

          // Fade out as it nears end of travel
          const fadeStart = ss.totalDist * 0.65;
          if (ss.traveled > fadeStart) {
            ss.alpha = Math.max(0, 1 - (ss.traveled - fadeStart) / (ss.totalDist - fadeStart));
          }

          if (ss.traveled < ss.totalDist && ss.alpha > 0.01) {
            const tailLen = Math.min(ss.traveled, SHOOT_TAIL);
            const tailX   = ss.x - ss.vx / SHOOT_SPEED * tailLen;
            const tailY   = ss.y - ss.vy / SHOOT_SPEED * tailLen;

            const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(1, `rgba(255,255,255,${(ss.alpha * gA).toFixed(3)})`);

            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(ss.x, ss.y);
            ctx.strokeStyle = grad;
            ctx.lineWidth   = 1.5;
            ctx.lineCap     = 'round';
            ctx.stroke();

            // Bright tip
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
        // Clear shooting star if condition changes
        shootingRef.current = null;
        nextShootMs.current = 0;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
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
