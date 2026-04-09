import { STATION_URL } from './config';
import { StationRaw } from './types';

export async function fetchStation(): Promise<StationRaw | null> {
  try {
    const res = await fetch(STATION_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.error(`[FETCH] Station returned HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as StationRaw;
    if (json.error) {
      console.error(`[FETCH] Station API error: ${json.error}`);
      return null;
    }
    return json;
  } catch (err) {
    console.error(`[FETCH] Failed to reach station: ${(err as Error).message}`);
    return null;
  }
}
