'use client';

import { useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useTranslations } from 'next-intl';

interface Props {
  src: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

function centerSquareCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 85 }, 1, width, height),
    width,
    height,
  );
}

async function cropToBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const size = 400;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0, 0, size, size,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      'image/jpeg',
      0.9,
    );
  });
}

export default function AvatarCropper({ src, onConfirm, onCancel }: Props) {
  const t = useTranslations('profile');
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerSquareCrop(width, height));
  }, []);

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop) return;
    const blob = await cropToBlob(imgRef.current, completedCrop);
    onConfirm(blob);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Fixed-height container prevents layout shift during drag */}
      <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={1}
          circularCrop
          minWidth={60}
          style={{ maxHeight: 280 }}
        >
          <img
            ref={imgRef}
            src={src}
            alt="Crop preview"
            style={{ maxWidth: '100%', maxHeight: '280px', display: 'block' }}
            onLoad={onImageLoad}
          />
        </ReactCrop>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={handleConfirm} disabled={!completedCrop} className="btn flex-1">
          {t('usePhoto')}
        </button>
        <button type="button" onClick={onCancel} className="btn-outline">
          {t('cancelCrop')}
        </button>
      </div>
    </div>
  );
}
