'use client';

/**
 * RainCanvas — overcast overlay + rain streaks + bottom splash effect.
 *
 * Drops live in **document space**: they spawn at the document top and fall
 * to the document bottom.  The canvas is viewport-sized (position: fixed),
 * and ctx.translate(0, -scrollY) maps document→viewport each frame, so
 * scrolling fast downward makes the drops appear to drift upward.
 *
 * Layer order (z-index):
 *   AtmosphereCanvas  z: -1  (WebGL sky, fixed)
 *   RainCanvas        z:  0  (this file, fixed)
 *   page content      z:  1
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AtmosphereCondition } from './AtmosphereCanvas';

// ── Tunables ──────────────────────────────────────────────────────────────────

const DROP_COUNT          = 90;
const ANGLE_DEG           = 14;
const SPEED_MIN           = 3.5;    // px / frame  (doc-space, ~60 fps)
const SPEED_MAX           = 8.0;
const LENGTH_MIN_VH       = 0.025;  // streak length as fraction of viewport height
const LENGTH_MAX_VH       = 0.060;
const ALPHA_MIN           = 0.12;
const ALPHA_MAX           = 0.40;
const LERP                = 0.045;  // opacity lerp per frame
const FRAME_MS            = 1000 / 60;
const SPLASH_DURATION_MIN = 320;    // ms
const SPLASH_DURATION_MAX = 520;
const SPLASH_MAX_RADIUS   = 22;     // px at end-of-life
const SPLASH_MAX_COUNT    = 60;

// ── Overcast veil ─────────────────────────────────────────────────────────────

const OVERLAY_DAY: Partial<Record<AtmosphereCondition, { r: number; g: number; b: number; maxA: number }>> = {
  PartlyCloudy: { r: 195, g: 205, b: 212, maxA: 0.16 },
  Cloudy:       { r: 175, g: 188, b: 196, maxA: 0.46 },
  Rainy:        { r: 150, g: 163, b: 173, maxA: 0.62 },
};
const NIGHT = { r: 8, g: 10, b: 20 };

function overlayColor(
  cond: AtmosphereCondition,
  sunElevation: number,
): { r: number; g: number; b: number; maxA: number } | null {
  const day = OVERLAY_DAY[cond];
  if (!day) return null;
  const dayFactor = Math.max(0, Math.min(1, (sunElevation + 0.10) / 0.25));
  return {
    r:    Math.round(NIGHT.r + (day.r - NIGHT.r) * dayFactor),
    g:    Math.round(NIGHT.g + (day.g - NIGHT.g) * dayFactor),
    b:    Math.round(NIGHT.b + (day.b - NIGHT.b) * dayFactor),
    maxA: day.maxA,
  };
}

const RAIN_CONDITIONS: Set<AtmosphereCondition> = new Set(['Rainy']);

// ── Drop / Splash types ───────────────────────────────────────────────────────

interface Drop {
  x: number; y: number;   // document-space coordinates
  vx: number; vy: number;
  len: number;            // streak length (px, viewport-relative)
  alpha: number;
}

interface Splash {
  x: number; y: number;  // document-space
  created: number;        // rAF timestamp (ms)
  duration: number;
}

/**
 * Spawns a drop in document space.
 * xOverflow: the horizontal distance a drop travels across one viewport height —
 * ensures the bottom-left corner stays covered despite the tilt.
 */
function makeDrop(W: number, docH: number, vpH: number, randomY = true): Drop {
  const vy        = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
  const vx        = vy * Math.tan(ANGLE_DEG * Math.PI / 180);
  const len       = (LENGTH_MIN_VH + Math.random() * (LENGTH_MAX_VH - LENGTH_MIN_VH)) * vpH;
  // xOverflow based on viewport height — covers the tilt gap at any scroll position
  const xOverflow = vpH * Math.tan(ANGLE_DEG * Math.PI / 180);
  return {
    x:     -xOverflow + Math.random() * (W + xOverflow),
    y:     randomY ? Math.random() * (docH + len) - len : -len,
    vx, vy, len,
    alpha: ALPHA_MIN + Math.random() * (ALPHA_MAX - ALPHA_MIN),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  condition:    AtmosphereCondition;
  sunElevation: number;  // radians; negative = night
}

export default function RainCanvas({ condition, sunElevation }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const conditionRef = useRef(condition);
  const sunRef       = useRef(sunElevation);
  const dropsRef     = useRef<Drop[]>([]);
  const splashesRef  = useRef<Splash[]>([]);
  const rafRef       = useRef<number>(0);
  const overlayAlpha = useRef(0);
  const rainAlpha    = useRef(0);
  const docHeightRef = useRef(0);

  useEffect(() => { conditionRef.current = condition;    }, [condition]);
  useEffect(() => { sunRef.current       = sunElevation; }, [sunElevation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Track document height so drops know when to splash + reset
    const updateDocHeight = () => {
      docHeightRef.current = document.documentElement.scrollHeight;
    };
    updateDocHeight();
    const ro = new ResizeObserver(updateDocHeight);
    ro.observe(document.documentElement);

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      const dh = docHeightRef.current || window.innerHeight;
      dropsRef.current = Array.from({ length: DROP_COUNT }, () =>
        makeDrop(canvas.width, dh, canvas.height, true),
      );
      splashesRef.current = [];
    };
    resize();
    window.addEventListener('resize', resize);

    const sinA = Math.sin(ANGLE_DEG * Math.PI / 180);
    const cosA = Math.cos(ANGLE_DEG * Math.PI / 180);
    let lastTs = 0;

    const draw = (ts: number) => {
      const dt      = lastTs > 0 ? Math.min((ts - lastTs) / FRAME_MS, 4) : 1;
      lastTs        = ts;

      const cond    = conditionRef.current;
      const elev    = sunRef.current;
      const W       = canvas.width;
      const H       = canvas.height;           // viewport height
      const docH    = docHeightRef.current || H;
      const scrollY = window.scrollY;

      // ── Lerp opacities ──
      const ovCfg        = overlayColor(cond, elev);
      const overlayTarget = ovCfg?.maxA ?? 0;
      const rainTarget    = RAIN_CONDITIONS.has(cond) ? 1 : 0;

      overlayAlpha.current += (overlayTarget - overlayAlpha.current) * LERP * dt;
      rainAlpha.current    += (rainTarget    - rainAlpha.current)    * LERP * dt;

      const oA = overlayAlpha.current;
      const rA = rainAlpha.current;

      ctx.clearRect(0, 0, W, H);

      // ── 1. Overcast veil (viewport space — drawn before translate) ──
      if (oA > 0.005 && ovCfg) {
        const { r, g, b } = ovCfg;
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0,   `rgba(${r - 12},${g - 12},${b - 8},${oA})`);
        grad.addColorStop(0.6, `rgba(${r},${g},${b},${(oA * 0.85).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${r + 18},${g + 18},${b + 15},${(oA * 0.50).toFixed(3)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // ── 2 + 3. Drops and splashes in document space ──
      // Translate so document-y=0 maps to viewport-y=0 at scrollY=0, etc.
      if (rA > 0.005) {
        ctx.save();
        ctx.translate(0, -scrollY);

        // Clip to viewport so translated content doesn't bleed outside
        ctx.beginPath();
        ctx.rect(0, scrollY, W, H);
        ctx.clip();

        ctx.lineCap = 'round';

        // ── Streaks ──
        for (const d of dropsRef.current) {
          d.x += d.vx * dt;
          d.y += d.vy * dt;

          // Splash + reset when the tail clears the document bottom
          if (d.y - d.len > docH) {
            if (splashesRef.current.length < SPLASH_MAX_COUNT) {
              splashesRef.current.push({
                x:        d.x,
                y:        docH,
                created:  ts,
                duration: SPLASH_DURATION_MIN +
                          Math.random() * (SPLASH_DURATION_MAX - SPLASH_DURATION_MIN),
              });
            }
            Object.assign(d, makeDrop(W, docH, H, false));
          }

          // Skip draw if the entire streak is outside the current viewport
          if (d.y < scrollY - d.len || d.y - d.len > scrollY + H) continue;

          const tx = d.x - sinA * d.len;
          const ty = d.y - cosA * d.len;

          const sg = ctx.createLinearGradient(tx, ty, d.x, d.y);
          sg.addColorStop(0, 'rgba(210,228,242,0)');
          sg.addColorStop(1, `rgba(210,228,242,${d.alpha.toFixed(3)})`);

          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(d.x, d.y);
          ctx.strokeStyle = sg;
          ctx.lineWidth   = 1.1;
          ctx.globalAlpha = rA;
          ctx.stroke();
        }

        // ── Splashes ──
        ctx.globalAlpha = 1;
        splashesRef.current = splashesRef.current.filter(s => {
          const elapsed = ts - s.created;
          if (elapsed >= s.duration) return false;

          // Only draw when the splash row is within the viewport
          const viewportY = s.y - scrollY;
          if (viewportY < -SPLASH_MAX_RADIUS || viewportY > H + SPLASH_MAX_RADIUS) return true;

          const p  = elapsed / s.duration;
          const r  = p * SPLASH_MAX_RADIUS;
          const a  = (1 - p) * 0.55 * rA;

          // Expanding ellipse — perspective of a surface ripple
          ctx.beginPath();
          ctx.ellipse(s.x, s.y - 1, r * 2.4, r * 0.65, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(210,228,242,${a.toFixed(3)})`;
          ctx.lineWidth   = 0.9;
          ctx.stroke();

          // Tiny bounce streak at impact (first 30% of life)
          if (p < 0.30) {
            const bA = (1 - p / 0.30) * 0.50 * rA;
            const bH = (1 - p / 0.30) * 7;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x, s.y - bH);
            ctx.strokeStyle = `rgba(210,228,242,${bA.toFixed(3)})`;
            ctx.lineWidth   = 0.8;
            ctx.stroke();
          }

          return true;
        });

        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
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
        zIndex:        0,
        pointerEvents: 'none',
        display:       'block',
      }}
    />,
    document.body,
  );
}
