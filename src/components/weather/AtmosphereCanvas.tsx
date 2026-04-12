'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export type AtmosphereCondition =
  | 'Clear' | 'PartlyCloudy' | 'Cloudy' | 'Rainy' | 'Windy' | 'Unknown';

export interface AtmosphereProps {
  /** True solar elevation in radians. Negative = sun below horizon (night/twilight). */
  sunElevation: number;
  /** −1 = east (dawn), 0 = south (noon), +1 = west (dusk) */
  sunAzimuth: number;
  condition: AtmosphereCondition;
}

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT_SRC = /* glsl */ `
attribute vec2 aPosition;
varying   vec2 vPosition;

void main() {
  vPosition   = aPosition;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// atmosphere() function inlined from glsl-atmosphere (MIT)
// https://github.com/wwwtyro/glsl-atmosphere
const FRAG_SRC = /* glsl */ `
precision highp float;

varying vec2  vPosition;
uniform vec3  uSunPos;
uniform float uMieMult;      // 1 = clear sky, higher = hazy/overcast
uniform float uSunIntensity; // 22 = clear, lower = overcast
uniform float uAspect;       // canvas width / height — corrects sun circularity

#define PI     3.141592
#define iSteps 16
#define jSteps 8

// Ray–sphere intersection (sphere centred at origin).
vec2 rsi(vec3 r0, vec3 rd, float sr) {
  float a = dot(rd, rd);
  float b = 2.0 * dot(rd, r0);
  float c = dot(r0, r0) - sr * sr;
  float d = b * b - 4.0 * a * c;
  if (d < 0.0) return vec2(1e5, -1e5);
  return vec2(
    (-b - sqrt(d)) / (2.0 * a),
    (-b + sqrt(d)) / (2.0 * a)
  );
}

// Rayleigh + Mie single-scattering atmosphere model.
vec3 atmosphere(
  vec3  r,        // normalised view direction
  vec3  r0,       // ray origin (metres above sea level)
  vec3  pSun,     // direction toward sun
  float iSun,     // sun intensity
  float rPlanet,  // planet radius (m)
  float rAtmos,   // atmosphere radius (m)
  vec3  kRlh,     // Rayleigh scattering coefficients
  float kMie,     // Mie scattering coefficient
  float shRlh,    // Rayleigh scale height (m)
  float shMie,    // Mie scale height (m)
  float g         // Mie preferred scattering direction
) {
  pSun = normalize(pSun);
  r    = normalize(r);

  vec2 p = rsi(r0, r, rAtmos);
  if (p.x > p.y) return vec3(0.0);
  p.y = min(p.y, rsi(r0, r, rPlanet).x);

  float iStepSize = (p.y - p.x) / float(iSteps);
  float iTime     = 0.0;

  vec3  totalRlh = vec3(0.0);
  vec3  totalMie = vec3(0.0);
  float iOdRlh   = 0.0;
  float iOdMie   = 0.0;

  float mu   = dot(r, pSun);
  float mumu = mu * mu;
  float gg   = g * g;
  float pRlh = 3.0 / (16.0 * PI) * (1.0 + mumu);
  float pMie = 3.0 / (8.0  * PI) *
               ((1.0 - gg) * (mumu + 1.0)) /
               (pow(1.0 + gg - 2.0 * mu * g, 1.5) * (2.0 + gg));

  for (int i = 0; i < iSteps; i++) {
    vec3  iPos    = r0 + r * (iTime + iStepSize * 0.5);
    float iHeight = length(iPos) - rPlanet;

    float odStepRlh = exp(-iHeight / shRlh) * iStepSize;
    float odStepMie = exp(-iHeight / shMie) * iStepSize;
    iOdRlh += odStepRlh;
    iOdMie += odStepMie;

    float jStepSize = rsi(iPos, pSun, rAtmos).y / float(jSteps);
    float jTime     = 0.0;
    float jOdRlh    = 0.0;
    float jOdMie    = 0.0;

    for (int j = 0; j < jSteps; j++) {
      vec3  jPos    = iPos + pSun * (jTime + jStepSize * 0.5);
      float jHeight = length(jPos) - rPlanet;
      jOdRlh += exp(-jHeight / shRlh) * jStepSize;
      jOdMie += exp(-jHeight / shMie) * jStepSize;
      jTime  += jStepSize;
    }

    vec3 attn = exp(-(kMie * (iOdMie + jOdMie) + kRlh * (iOdRlh + jOdRlh)));
    totalRlh += odStepRlh * attn;
    totalMie += odStepMie * attn;
    iTime    += iStepSize;
  }

  return iSun * (pRlh * kRlh * totalRlh + pMie * kMie * totalMie);
}

void main() {
  // Map 2D screen position to a 3D view ray.
  // skyY: bottom of screen (y=-1) → horizon (0), top (y=+1) → ~58° above horizon.
  // skyX: aspect-corrected so angular coverage per pixel is equal in x and y,
  //        keeping the sun disc circular on any screen shape (portrait/landscape).
  float skyY = (vPosition.y + 1.0) * 0.8;
  float skyX = vPosition.x * 0.8 * uAspect;
  vec3 r = normalize(vec3(skyX, skyY, -1.0));

  vec3 color = atmosphere(
    r,
    vec3(0.0, 6372e3, 0.0),              // observer at sea level
    uSunPos,                              // sun direction (driven by time)
    uSunIntensity,
    6371e3,                               // Earth radius
    6471e3,                               // atmosphere top
    vec3(5.5e-6, 13.0e-6, 22.4e-6),      // Rayleigh (RGB)
    21e-6 * uMieMult,                     // Mie (scaled by weather condition)
    8e3,                                  // Rayleigh scale height
    1.2e3,                                // Mie scale height
    0.758                                 // Mie anisotropy
  );

  // Exposure / tone-mapping
  color = 1.0 - exp(-1.0 * color);

  gl_FragColor = vec4(color, 1.0);
}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function conditionParams(cond: AtmosphereCondition): { mieMult: number; sunIntensity: number } {
  switch (cond) {
    case 'Rainy':        return { mieMult: 15.0, sunIntensity: 4.0 };
    case 'Cloudy':       return { mieMult: 8.0,  sunIntensity: 7.0 };
    case 'PartlyCloudy': return { mieMult: 3.0,  sunIntensity: 14.0 };
    case 'Windy':        return { mieMult: 0.8,  sunIntensity: 24.0 };
    default:             return { mieMult: 1.0,  sunIntensity: 22.0 };
  }
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile error');
  }
  return shader;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GLState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  uSunPos: WebGLUniformLocation | null;
  uMieMult: WebGLUniformLocation | null;
  uSunIntensity: WebGLUniformLocation | null;
  uAspect: WebGLUniformLocation | null;
}

export default function AtmosphereCanvas({ sunElevation, sunAzimuth, condition }: AtmosphereProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const glStateRef  = useRef<GLState | null>(null);
  const rafRef      = useRef<number>(0);
  const needsRender = useRef(true);

  // ── WebGL initialisation (runs once on mount) ────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl') as WebGLRenderingContext | null
    );
    if (!gl) {
      // No WebGL — CSS gradient fallback on body stays visible.
      return;
    }

    try {
      const vert    = compileShader(gl, gl.VERTEX_SHADER,   VERT_SRC);
      const frag    = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
      const program = gl.createProgram()!;
      gl.attachShader(program, vert);
      gl.attachShader(program, frag);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? 'program link error');
      }

      // Fullscreen quad (two triangles)
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1,  1, -1,  1, 1,  -1, -1,  1, 1,  -1, 1]),
        gl.STATIC_DRAW,
      );

      gl.useProgram(program);
      const aPos = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      glStateRef.current = {
        gl,
        program,
        uSunPos:       gl.getUniformLocation(program, 'uSunPos'),
        uMieMult:      gl.getUniformLocation(program, 'uMieMult'),
        uSunIntensity: gl.getUniformLocation(program, 'uSunIntensity'),
        uAspect:       gl.getUniformLocation(program, 'uAspect'),
      };
    } catch (err) {
      console.warn('[AtmosphereCanvas] WebGL init failed:', err);
      return;
    }

    // Resize: update canvas pixel dimensions, viewport, and aspect uniform
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      canvas.width  = Math.round(window.innerWidth  * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      // Push updated aspect ratio so the sun disc stays circular
      if (glStateRef.current) {
        gl.useProgram(glStateRef.current.program);
        gl.uniform1f(glStateRef.current.uAspect, canvas.width / canvas.height);
      }
      needsRender.current = true;
    };
    resize();
    window.addEventListener('resize', resize);

    // rAF render loop — only draws when needsRender is set
    const loop = () => {
      const state = glStateRef.current;
      if (needsRender.current && state) {
        state.gl.drawArrays(state.gl.TRIANGLES, 0, 6);
        needsRender.current = false;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Push new uniforms whenever props change ──────────────────────────────
  useEffect(() => {
    const state = glStateRef.current;
    if (!state) return;

    const { gl, program, uSunPos, uMieMult, uSunIntensity } = state;
    const { mieMult, sunIntensity } = conditionParams(condition);

    // pSun: direction vector toward the sun (normalised inside the shader).
    // sunElevation is the true altitude in radians, so tan(elevation) gives the
    // correct y/z ratio for the direction vector pSun = (sunX, sunY, -1):
    //   elevation =  0 rad → sunY = 0   (sun exactly at horizon)
    //   elevation =  1.1 rad (~65°, equinox noon) → sunY ≈ 2.1
    //   elevation = -0.3 rad (below horizon) → sunY ≈ -0.31
    const sunX = sunAzimuth * 0.5;
    const sunY = Math.tan(sunElevation);

    gl.useProgram(program);
    gl.uniform3f(uSunPos,       sunX, sunY, -1.0);
    gl.uniform1f(uMieMult,      mieMult);
    gl.uniform1f(uSunIntensity, sunIntensity);
    needsRender.current = true;
  }, [sunElevation, sunAzimuth, condition]);

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

// ── Sun position helper (used by WeatherDashboard) ────────────────────────────

// NTHU Observatory, Hsinchu, Taiwan
const NTHU_LAT = 24.80 * (Math.PI / 180); // radians

/** Solar declination in radians for a given day-of-year (Spencer's equation). */
function solarDeclination(dayOfYear: number): number {
  return 23.45 * (Math.PI / 180) * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
}

/**
 * Compute the true solar elevation and azimuth from clock minutes and
 * today's sunrise / sunset times (all in minutes since midnight).
 *
 * Returns:
 *   elevation  actual solar altitude in **radians**
 *              negative = sun below horizon (night / twilight)
 *   azimuth    −1 (east/dawn) … 0 (south/noon) … +1 (west/dusk)
 */
export function computeSunPosition(
  currentMin: number,
  riseMin: number,
  setMin: number,
): { elevation: number; azimuth: number } {
  // Solar noon = midpoint of today's sunrise/sunset.
  // This implicitly absorbs the equation-of-time and longitude correction
  // because the API already returns the real local rise/set times.
  const solarNoonMin = (riseMin + setMin) / 2;

  // Hour angle in radians: 0 at solar noon, +π/2 six hours later (afternoon/west)
  const hourAngle = ((currentMin - solarNoonMin) / 60) * (Math.PI / 12);

  // Day of year for declination
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  const decl = solarDeclination(dayOfYear);

  // True solar elevation angle
  // sin(alt) = sin(lat)·sin(δ) + cos(lat)·cos(δ)·cos(H)
  const sinAlt =
    Math.sin(NTHU_LAT) * Math.sin(decl) +
    Math.cos(NTHU_LAT) * Math.cos(decl) * Math.cos(hourAngle);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  // Azimuth: sin(H) gives a smooth east(−1) → south(0) → west(+1) sweep.
  // Negative H = morning = sun in the east = negative x on screen.
  const azimuth = Math.sin(hourAngle);

  return { elevation, azimuth };
}
