import 'dotenv/config';
import { fetchAndStore } from './store';
import { updateMeteoblueCache } from './meteoblue';
import { updateCwaCache } from './cwa';
import { FETCH_INTERVAL_MS, METEOBLUE_INTERVAL_MS, CWA_INTERVAL_MS } from './config';

async function main() {
  console.log('[DAEMON] Starting weather daemon...');

  // Prime caches on startup
  await updateMeteoblueCache();
  await updateCwaCache();

  // First reading immediately
  await fetchAndStore();

  // Schedule repeating jobs
  setInterval(fetchAndStore, FETCH_INTERVAL_MS);
  setInterval(updateMeteoblueCache, METEOBLUE_INTERVAL_MS);
  setInterval(updateCwaCache, CWA_INTERVAL_MS);

  console.log(
    `[DAEMON] Running. Fetching every ${FETCH_INTERVAL_MS / 1000}s, ` +
    `Meteoblue every ${METEOBLUE_INTERVAL_MS / 60000}min, ` +
    `CWA every ${CWA_INTERVAL_MS / 60000}min.`,
  );
}

main().catch(err => {
  console.error('[DAEMON] FATAL:', err);
  process.exit(1);
});
