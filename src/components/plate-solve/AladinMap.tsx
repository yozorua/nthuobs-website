'use client';

import { useEffect, useRef, useState } from 'react';

const CDN = 'https://cdn.jsdelivr.net/npm/aladin-lite@3.9.0-beta/dist/aladin.js';
const WIN_KEY = '__aladinClass';
const WIN_EVT = '__aladinClassReady';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AladinClass = any;

let classPromise: Promise<AladinClass> | null = null;

function loadAladinClass(): Promise<AladinClass> {
  if (!classPromise) {
    classPromise = new Promise<AladinClass>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w[WIN_KEY]) { resolve(w[WIN_KEY] as AladinClass); return; }

      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import A from '${CDN}';
        window.${WIN_KEY} = A;
        window.dispatchEvent(new CustomEvent('${WIN_EVT}'));
      `;
      script.onerror = () => { classPromise = null; reject(new Error('Aladin CDN load failed')); };
      document.head.appendChild(script);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.addEventListener(WIN_EVT, () => resolve((window as any)[WIN_KEY] as AladinClass), { once: true });
    });
  }
  return classPromise;
}

/**
 * Compute the 4 sky corners of the solved field in [RA, Dec] pairs.
 *
 * PA (orientDeg) is the position angle of "image up" measured East of North.
 * For parity "neg" (normal astronomical orientation) East is to the left in the
 * image, so the right direction in the image corresponds to West in the sky.
 * For parity "pos" (mirrored) East is to the right.
 */
function fovCorners(
  ra: number, dec: number,
  widthDeg: number, heightDeg: number,
  orientDeg: number,
  parity: string,
): [number, number][] {
  const pa = (orientDeg * Math.PI) / 180;
  const sp = Math.sin(pa), cp = Math.cos(pa);
  const cosDec = Math.cos((dec * Math.PI) / 180);
  const hw = widthDeg / 2, hh = heightDeg / 2;

  // Tangent-plane unit vectors (Δra·cosDec, Δdec):
  //   "up"    = direction of +Dec axis in image = (sin PA, cos PA)
  //   "right" = perpendicular, sign depends on parity
  const upE = sp, upN = cp;
  const rtE = parity === 'pos' ? cp : -cp;
  const rtN = parity === 'pos' ? -sp : sp;

  // 4 corners at (±hw along right) + (±hh along up)
  const offsets: [number, number][] = [
    [ hh * upE + hw * rtE,  hh * upN + hw * rtN],
    [ hh * upE - hw * rtE,  hh * upN - hw * rtN],
    [-hh * upE - hw * rtE, -hh * upN - hw * rtN],
    [-hh * upE + hw * rtE, -hh * upN + hw * rtN],
  ];

  return offsets.map(([dE, dN]) => [ra + dE / cosDec, dec + dN]);
}

interface Props {
  ra: number;
  dec: number;
  /** Map display FOV in degrees (typically ~2× the solved field) */
  fovDeg: number;
  /** Solved field width in degrees */
  widthDeg: number;
  /** Solved field height in degrees */
  heightDeg: number;
  /** Position angle of image "up", degrees E of N */
  orientDeg: number;
  /** "pos" = mirrored (East right), "neg" = normal (East left) */
  parity: string;
  loadingLabel: string;
  unavailableLabel: string;
}

export default function AladinMap({
  ra, dec, fovDeg,
  widthDeg, heightDeg, orientDeg, parity,
  loadingLabel, unavailableLabel,
}: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const div = divRef.current;
    if (!div) return;
    let cancelled = false;

    (async () => {
      try {
        const A = await loadAladinClass();
        await A.init;
        if (cancelled) return;

        const aladin = A.aladin(div, {
          survey: 'P/DSS2/color',
          fov: fovDeg,
          target: `${ra} ${dec}`,
          showZoomControl: false,
          showFullscreenControl: false,
          showCooGrid: false,
          showSettingsControl: false,
          showShareControl: false,
          showContextMenu: false,
          showCatalog: false,
          backgroundColor: '#080810',
        });

        // Draw the solved FOV rectangle — wrapped so a failure never breaks the map
        try {
          const corners = fovCorners(ra, dec, widthDeg, heightDeg, orientDeg, parity);
          const overlay = A.graphicOverlay({ color: 'rgba(255, 210, 80, 0.9)', lineWidth: 1.5 });
          aladin.addOverlay(overlay);
          overlay.addFootprints([A.polygon(corners)]);
        } catch { /* overlay is cosmetic; silently ignore */ }

        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [ra, dec, fovDeg, widthDeg, heightDeg, orientDeg, parity]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 360 }}>
      <div ref={divRef} style={{ width: '100%', height: '100%' }} />
      {status !== 'ready' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-warm)',
          border: '1px solid var(--line)',
        }}>
          <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
            {status === 'loading' ? loadingLabel : unavailableLabel}
          </p>
        </div>
      )}
    </div>
  );
}
