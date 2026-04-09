import { useTranslations } from 'next-intl';

// When the all-sky camera path is available, replace this placeholder
// with an <img src={imagePath} /> or an appropriate live feed component.

export default function AllSkyCamera() {
  const t = useTranslations('weather');

  return (
    <div className="card p-5" style={{ borderColor: 'var(--line)' }}>
      <p className="label mb-3">{t('allSkyCamera')}</p>
      <div
        className="flex items-center justify-center"
        style={{
          height: 200,
          background: 'var(--bg-muted)',
          color: 'var(--ink-faint)',
        }}
      >
        <p className="text-sm">{t('allSkyCameraPlaceholder')}</p>
      </div>
    </div>
  );
}
