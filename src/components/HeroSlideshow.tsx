'use client';

import { useState, useEffect } from 'react';

const HOLD_MS = 8000;
const FADE_MS = 1200;

export default function HeroSlideshow({
  images,
  fallback,
}: {
  images: string[];
  fallback: string;
}) {
  const all = images.length > 0 ? images : [fallback];
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (all.length <= 1) return;
    const id = setInterval(() => {
      setCurrent((prev) => (prev + 1) % all.length);
    }, HOLD_MS);
    return () => clearInterval(id);
  }, [all.length]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      {all.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: i === current ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
          }}
        />
      ))}
    </div>
  );
}
