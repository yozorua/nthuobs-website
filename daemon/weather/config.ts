import path from 'path';

export const STATION_URL = 'http://192.168.0.203:8888/data';
export const FETCH_INTERVAL_MS = 15_000;
export const METEOBLUE_INTERVAL_MS = 60 * 60 * 1000;
export const CWA_INTERVAL_MS = 10 * 60 * 1000;
export const RETRY_COUNT = 3;
export const RETRY_DELAY_MS = 10_000;

export const SEEING_FORECAST_URL =
  'https://www.meteoblue.com/en/weather/outdoorsports/seeing/24.794N120.992E70_Asia%2FTaipei';

export const CWA_DATA_ID = 'F-C0032-024';
export const CWA_API_KEY =
  process.env.CWA_API_KEY ?? 'CWA-F5338160-CB8F-4878-A2E5-B686D2860F95';
export const CWA_FORECAST_URL = `https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/${CWA_DATA_ID}?Authorization=${CWA_API_KEY}&format=JSON`;

const CACHE_DIR = path.join(__dirname, 'cache');
export const METEOBLUE_CACHE = path.join(CACHE_DIR, 'meteoblue.json');
export const CWA_CACHE = path.join(CACHE_DIR, 'cwa.json');
