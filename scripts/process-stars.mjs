/**
 * Fetches the Yale BSC5 (short form) from brettonw's GitHub Pages and converts
 * it into a compact flat JSON array for StarCanvas.tsx.
 *
 * Output format: Array of [ra_rad, dec_rad, vmag, kelvin]
 *   ra_rad  — Right Ascension in radians  (0 … 2π)
 *   dec_rad — Declination in radians       (-π/2 … +π/2)
 *   vmag    — Visual magnitude (lower = brighter; faint limit ≈ 6.5)
 *   kelvin  — Approximate blackbody temperature in K (2450 … 33000)
 *
 * Run:  node scripts/process-stars.mjs
 */

const SRC = 'https://brettonw.github.io/YaleBrightStarCatalog/bsc5-short.json';
const OUT = 'public/data/stars.json';

import { writeFileSync } from 'fs';

// ── Parsers ───────────────────────────────────────────────────────────────────

// "00h 05m 09.9s"  →  decimal hours
function parseRA(s) {
  const m = s.match(/(\d+)h\s*(\d+)m\s*([\d.]+)s/);
  if (!m) return null;
  return parseInt(m[1]) + parseInt(m[2]) / 60 + parseFloat(m[3]) / 3600;
}

// "+45° 13′ 45″"  or  "-05° 42′ 27″"  →  decimal degrees
function parseDec(s) {
  const m = s.match(/([+-]?)(\d+)[°]\s*(\d+)[′']\s*([\d.]+)[″"]/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (parseInt(m[2]) + parseInt(m[3]) / 60 + parseFloat(m[4]) / 3600);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('Fetching BSC5 catalog…');
const res  = await fetch(SRC);
if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.url}`);
const raw  = await res.json();

const stars = [];
let skipped = 0;

for (const entry of raw) {
  const raDeg  = parseRA(entry.RA);
  const decDeg = parseDec(entry.Dec);
  const vmag   = parseFloat(entry.V);
  const kelvin = parseInt(entry.K, 10);

  if (raDeg == null || decDeg == null || isNaN(vmag) || isNaN(kelvin)) {
    skipped++;
    continue;
  }

  // Include all stars visible to the naked eye (magnitude ≤ 6.5)
  // Plus a small over-read for stars just past the limit (atmospheric seeing
  // can make borderline stars detectable from a dark site like NTHU hill).
  if (vmag > 6.8) { skipped++; continue; }

  const ra_rad  = raDeg  * (Math.PI / 12);   // hours → radians
  const dec_rad = decDeg * (Math.PI / 180);  // degrees → radians

  // 4-element tuple — keep as integers/fixed-precision to minimise file size
  stars.push([
    parseFloat(ra_rad.toFixed(6)),
    parseFloat(dec_rad.toFixed(6)),
    parseFloat(vmag.toFixed(2)),
    kelvin,
  ]);
}

console.log(`Processed ${stars.length} stars  (${skipped} skipped)`);

const json = JSON.stringify(stars);
writeFileSync(OUT, json, 'utf8');
console.log(`Written → ${OUT}  (${(json.length / 1024).toFixed(1)} KB)`);
