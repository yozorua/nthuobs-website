'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface WcsParams {
  crpix1: number; crpix2: number;
  crval1: number; crval2: number;
  cd11: number; cd12: number;
  cd21: number; cd22: number;
}

interface AnnotationData {
  width: number;
  height: number;
  wcs: WcsParams;
  fov_width_deg: number;
  fov_height_deg: number;
  pixscale: number;
  grid_lines: [number, number][][];
  objects: { name: string; x: number; y: number; r: number; type: string }[];
  stars: { name: string | null; x: number; y: number; vmag: number }[];
}

interface Props {
  resultId: string;
  hasImage: boolean;
  hasAnnotations: boolean;
  noPreviewLabel: string;
}

// ── coordinate helpers ───────────────────────────────────────────────────────

function pixelToSky(
  px_pil: number, py_pil: number,
  w: WcsParams, img_h: number,
): { ra: number; dec: number } {
  // PIL (0-indexed, y↓) → FITS (1-indexed, y↑)
  const fits_x = px_pil + 1;
  const fits_y = img_h - py_pil;
  const dx = fits_x - w.crpix1;
  const dy = fits_y - w.crpix2;
  // Intermediate world coords (degrees) via CD matrix
  const xi  = w.cd11 * dx + w.cd12 * dy;
  const eta = w.cd21 * dx + w.cd22 * dy;
  // TAN deprojection (Calabretta & Greisen 2002)
  const D = Math.PI / 180;
  const xi_r = xi * D, eta_r = eta * D;
  const ra0 = w.crval1 * D, dec0 = w.crval2 * D;
  const denom = Math.cos(dec0) - eta_r * Math.sin(dec0);
  const ra_r  = ra0 + Math.atan2(xi_r, denom);
  const dec_r = Math.atan2(
    (eta_r * Math.cos(dec0) + Math.sin(dec0)) * Math.cos(ra_r - ra0),
    denom,
  );
  return {
    ra:  ((ra_r  / D) % 360 + 360) % 360,
    dec: dec_r / D,
  };
}

function raToHMS(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  const h = d / 15, hh = Math.floor(h);
  const m = (h - hh) * 60, mm = Math.floor(m);
  const s = (m - mm) * 60;
  return `${String(hh).padStart(2,'0')}h ${String(mm).padStart(2,'0')}m ${s.toFixed(1).padStart(4,'0')}s`;
}

function decToDMS(deg: number): string {
  const sign = deg >= 0 ? '+' : '−';
  const abs = Math.abs(deg);
  const d = Math.floor(abs), m = Math.floor((abs - d) * 60);
  const s = Math.round(((abs - d) * 60 - m) * 60);
  return `${sign}${String(d).padStart(2,'0')}° ${String(m).padStart(2,'0')}′ ${String(s).padStart(2,'0')}″`;
}

function fmtFov(wDeg: number, hDeg: number): string {
  const lg = Math.max(wDeg, hDeg);
  if (lg >= 1)    return `${wDeg.toFixed(2)}° × ${hDeg.toFixed(2)}°`;
  if (lg >= 1/60) return `${(wDeg * 60).toFixed(1)}′ × ${(hDeg * 60).toFixed(1)}′`;
  return `${(wDeg * 3600).toFixed(0)}″ × ${(hDeg * 3600).toFixed(0)}″`;
}

// ── overlay style ────────────────────────────────────────────────────────────

const BOX: React.CSSProperties = {
  position: 'absolute',
  background: 'rgba(0,0,0,0.62)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.92)',
  fontFamily: 'monospace',
  fontSize: 11,
  lineHeight: 1.65,
  padding: '3px 8px',
  borderRadius: 2,
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  transition: 'opacity 0.15s ease',
};

const DIM: React.CSSProperties = { color: 'rgba(255,255,255,0.45)' };
// Two-column grid inside each info box: label column auto-sizes to widest label,
// value column takes the rest. This avoids any HTML whitespace-collapsing issues.
const INFO_GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 8 };

// ── component ────────────────────────────────────────────────────────────────

export default function AnnotationCanvas({
  resultId, hasImage, hasAnnotations, noPreviewLabel,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const [ann, setAnn]         = useState<AnnotationData | null>(null);
  const [cursor, setCursor]   = useState<{ ra: number; dec: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  // Fetch annotations once
  useEffect(() => {
    if (!hasAnnotations) return;
    fetch(`/api/plate-solve/annotations/${resultId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: AnnotationData | null) => setAnn(d))
      .catch(() => null);
  }, [resultId, hasAnnotations]);

  // Canvas draw
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !ann) return;
    const W = container.clientWidth, H = container.clientHeight;
    if (!W || !H) return;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const sx = W / ann.width, sy = H / ann.height;

    // Grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 5]);
    for (const line of ann.grid_lines) {
      if (line.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(line[0][0] * sx, line[0][1] * sy);
      for (let i = 1; i < line.length; i++) ctx.lineTo(line[i][0] * sx, line[i][1] * sy);
      ctx.stroke();
    }
    ctx.restore();

    // DSO circles
    for (const obj of ann.objects) {
      const cx = obj.x * sx, cy = obj.y * sy, r = Math.max(obj.r * sx, 5);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,215,0,0.85)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#FFD700';
      ctx.font = `${Math.max(9, Math.round(10 * Math.min(sx, sy)))}px monospace`;
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
      ctx.fillText(obj.name, cx + r + 4, cy + 4);
      ctx.restore();
    }

    // Stars
    for (const star of ann.stars) {
      const x = star.x * sx, y = star.y * sy;
      ctx.save();
      ctx.fillStyle = 'rgba(80,210,255,0.9)';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      if (star.name) {
        ctx.fillStyle = '#50D2FF';
        ctx.font = `${Math.max(8, Math.round(9 * Math.min(sx, sy)))}px monospace`;
        ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
        ctx.fillText(star.name, x + 5, y - 3);
      }
      ctx.restore();
    }
  }, [ann]);

  useEffect(() => {
    // Defer one animation frame so the browser has finished layout before we
    // read clientWidth/clientHeight. This fixes the cached-image race where
    // the image loads instantly (from cache), onLoad fires before ann arrives,
    // and the later ann-triggered redraw sees H=0 because layout isn't done.
    const id = requestAnimationFrame(redraw);
    return () => cancelAnimationFrame(id);
  }, [redraw]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(redraw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [redraw]);

  // Mouse handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ann?.wcs) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const px = mx / rect.width  * ann.width;
    const py = my / rect.height * ann.height;
    try {
      setCursor(pixelToSky(px, py, ann.wcs, ann.height));
    } catch {
      setCursor(null);
    }
  }, [ann]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    setCursor(null);
  }, []);

  const overlayOpacity = hovered ? 1 : 0;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', cursor: 'crosshair' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {/* Image */}
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/plate-solve/image/${resultId}`}
          alt="Solved field"
          className="w-full block"
          style={{ border: '1px solid var(--line)', display: 'block' }}
          onLoad={redraw}
        />
      ) : (
        <div className="flex items-center justify-center text-sm"
          style={{ minHeight: 200, border: '1px solid var(--line)', color: 'var(--ink-faint)' }}>
          {noPreviewLabel}
        </div>
      )}

      {/* Annotation canvas */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        opacity: overlayOpacity,
        transition: 'opacity 0.15s ease',
      }} />

      {/* Top-left: cursor RA / Dec */}
      {ann?.wcs && (
        <div style={{ ...BOX, top: 8, left: 8, opacity: overlayOpacity, ...INFO_GRID }}>
          <span style={DIM}>RA (J2000)</span>
          {/* leading non-breaking space compensates for the +/− sign in Dec */}
          <span>{cursor ? ' ' + raToHMS(cursor.ra)  : '—'}</span>
          <span style={DIM}>Dec (J2000)</span>
          <span>{cursor ? decToDMS(cursor.dec) : '—'}</span>
        </div>
      )}

      {/* Bottom-left: FOV info */}
      {ann && (
        <div style={{ ...BOX, bottom: 8, left: 8, opacity: overlayOpacity, ...INFO_GRID }}>
          <span style={DIM}>FOV</span>
          <span>{fmtFov(ann.fov_width_deg, ann.fov_height_deg)}</span>
          <span style={DIM}>Scale</span>
          <span>{ann.pixscale.toFixed(2)}″/px</span>
        </div>
      )}
    </div>
  );
}
