'use client';

import { useEffect, useRef, useState } from 'react';

const METEOGRAM_URL =
  'https://www.meteoblue.com/en/weather/widget/meteogram/24.794N120.992E70_Asia%2FTaipei?geoloc=fixed&temperature_units=CELUSIUS&windspeed_units=METER_PER_SECOND&precipitation_units=MILLIMETER&forecast_days=5&layout=dark&autowidth=auto&user_key=83cacefb64f401b4&embed_key=0b32410ed6ac83ad&sig=b63c8040f5fef324d1d29ca538d0e2b53b2c02f733beb7552252eb779985f93f';

export default function MeteogramEmbed() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const doc = ref.current?.contentDocument;
        if (doc === null || doc === undefined) setBlocked(true);
      } catch {
        setBlocked(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="card p-5">
      {blocked ? (
        <div
          className="flex items-center justify-center"
          style={{ height: 360, background: 'var(--bg-muted)', color: 'var(--ink-faint)', fontSize: 12 }}
        >
          Embed available on the deployed site
        </div>
      ) : (
        <iframe
          ref={ref}
          src={METEOGRAM_URL}
          title="5-day Meteogram"
          className="w-full"
          style={{ height: 360, border: 'none' }}
          allowFullScreen
        />
      )}
    </div>
  );
}
