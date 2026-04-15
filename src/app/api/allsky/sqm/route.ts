import { NextResponse } from 'next/server';
import https from 'https';

const SQM_URL =
  'https://192.168.0.203/indi-allsky/js/loop?camera_id=1&limit=1&limit_s=300';

// Self-signed cert on local network — skip TLS verification
const agent = new https.Agent({ rejectUnauthorized: false });

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https.get(url, { agent }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

export async function GET() {
  try {
    const data = await fetchJson(SQM_URL);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'SQM data unavailable' }, { status: 503 });
  }
}
