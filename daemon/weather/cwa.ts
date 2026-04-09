import fs from 'fs/promises';
import { CWA_FORECAST_URL, CWA_CACHE } from './config';

export async function updateCwaCache(): Promise<void> {
  console.log('[CWA] Fetching forecast...');
  try {
    const res = await fetch(CWA_FORECAST_URL, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      console.error(`[CWA] HTTP ${res.status}`);
      return;
    }
    const data = await res.json();
    await fs.writeFile(CWA_CACHE, JSON.stringify(data, null, 2), 'utf-8');
    console.log('[CWA] Forecast saved to cache');
  } catch (err) {
    console.error('[CWA] Error:', (err as Error).message);
  }
}
