'use client';

import { useEffect, useState } from 'react';

// Store both URLs verbatim — the sig is computed over the exact parameter order,
// so reconstructing the URL would break signature validation.
const URLS: Record<'dark' | 'bright', string> = {
  dark:
    'https://www.meteoblue.com/en/weather/widget/meteogram/24.794N120.992E70_Asia%2FTaipei?geoloc=fixed&temperature_units=CELSIUS&windspeed_units=METER_PER_SECOND&precipitation_units=MILLIMETER&forecast_days=5&layout=dark&autowidth=auto&user_key=83cacefb64f401b4&embed_key=412792e98609d87a&sig=1f45adf0fe21c9acdd61d23e6ee74bbcd4c785e973f34453f9877c11c7774018',
  bright:
    'https://www.meteoblue.com/en/weather/widget/meteogram/24.794N120.992E70_Asia%2FTaipei?geoloc=fixed&temperature_units=CELSIUS&windspeed_units=METER_PER_SECOND&precipitation_units=MILLIMETER&forecast_days=5&layout=bright&autowidth=auto&user_key=83cacefb64f401b4&embed_key=62d0e3bdd38dd244&sig=17394c0a5ba88c79bdc60667e070c340b909283ba512b7a137fd439cc310b3a2',
};

const METEOBLUE_LINK = 'https://www.meteoblue.com/en/weather/week/index';
const PRODUCTION_HOST = 'nthuobs.phys.nthu.edu.tw';

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

interface Props {
  sunrise?: string | null;
  sunset?: string | null;
}

export default function MeteogramEmbed({ sunrise, sunset }: Props) {
  const [isProduction, setIsProduction] = useState(false);
  const [layout, setLayout] = useState<'dark' | 'bright'>('dark');

  useEffect(() => {
    setIsProduction(window.location.hostname === PRODUCTION_HOST);
  }, []);

  // Recompute layout whenever sun times or the minute-of-day changes.
  useEffect(() => {
    const compute = () => {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const riseMin = sunrise ? toMin(sunrise) : 6 * 60;
      const setMin  = sunset  ? toMin(sunset)  : 18 * 60;
      setLayout(nowMin >= riseMin && nowMin < setMin ? 'bright' : 'dark');
    };
    compute();
    // Re-check every minute so it switches automatically at sunrise/sunset.
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
  }, [sunrise, sunset]);

  return (
    <div className="card p-5">
      {isProduction ? (
        <>
          <iframe
            key={layout}           // remount when layout changes to reload the src
            src={URLS[layout]}
            title="5-day Meteogram"
            frameBorder={0}
            scrolling="no"
            allowTransparency
            sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
            className="w-full"
            style={{ height: 400, border: 0, overflow: 'hidden' }}
          />
          {/* DO NOT REMOVE THIS LINK — required by meteoblue */}
          <div className="mt-1 text-right">
            <a
              href={METEOBLUE_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 10, color: 'var(--ink-faint)' }}
            >
              meteoblue
            </a>
          </div>
        </>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-2"
          style={{ height: 400, color: 'var(--ink-faint)', fontSize: 12 }}
        >
          <span>Meteogram available on the deployed site</span>
          <a
            href={METEOBLUE_LINK}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--ink-muted)', textDecoration: 'underline', fontSize: 11 }}
          >
            Open on meteoblue ↗
          </a>
        </div>
      )}
    </div>
  );
}
