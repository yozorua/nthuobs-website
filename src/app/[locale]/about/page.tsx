import { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = { title: 'About' };

const photoSrcs = [
  '/about/20201014125712-0001_page-0001.jpg',
  '/about/20201014125140-0001_page-0006.jpg',
  '/about/20201014125140-0001_page-0003.jpg',
  '/about/20201014130905-0001_pages-to-jpg-0003_1.jpeg',
];

const refs = [
  {
    text: '葉炳輝（民60）〈磨製天文望遠鏡記感〉，《時空》第十三期，27–29。',
    href: 'https://web.phys.ntu.edu.tw/physhistory/spacetime/vol_13/v13_p27.pdf',
  },
  {
    text: '清大天文社四十週年社慶網頁',
    href: 'https://sites.google.com/site/nthuastro40th/history',
  },
  {
    text: '國立清華大學物理學系－系所簡介',
    href: 'http://phys.site.nthu.edu.tw/p/404-1335-154672.php?Lang=zh-tw',
  },
];

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });

  const timeline = t.raw('timeline') as Array<{ date: string; event: string }>;
  const photos = t.raw('photos') as Array<{ caption: string }>;
  const equipment = t.raw('equipment') as Array<{ name: string; detail: string }>;

  const quickFacts = [
    [t('factFounded'), '1971'],
    [t('factLocation'), t('factLocationValue')],
    [t('factCity'), t('factCityValue')],
    [t('factEmail'), 'nthuobs@gmail.com'],
    [t('factUnder'), t('factUnderValue')],
  ];

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
      {/* Header */}
      <div className="mb-14 pb-8" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="label mb-3">{t('sinceLabel')}</p>
        <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>{t('title')}</h1>
      </div>

      {/* Main text */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
        <div className="md:col-span-2 space-y-5 text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
          <p>{t('p1')}</p>
          <p>{t('p2')}</p>
          <p>{t('p3')}</p>
          <p>{t('p4')}</p>
          <p>{t('p5')}</p>
          <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{t('credit')}</p>
        </div>

        <div>
          <div className="p-5" style={{ border: '1px solid var(--line)' }}>
            <p className="label mb-4">{t('quickFacts')}</p>
            <dl className="space-y-4">
              {quickFacts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs mb-0.5" style={{ color: 'var(--ink-faint)' }}>{label}</dt>
                  <dd className="text-xs" style={{ color: 'var(--ink)' }}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Founding timeline */}
      <div className="mb-16">
        <p className="label mb-8">{t('timelineLabel')}</p>
        <div className="pl-6 space-y-5" style={{ borderLeft: '1px solid var(--line)' }}>
          {timeline.map((item) => (
            <div key={item.date} className="flex gap-6">
              <span className="text-xs w-28 shrink-0 pt-0.5" style={{ color: 'var(--ink-faint)' }}>{item.date}</span>
              <span className="text-sm" style={{ color: 'var(--ink)' }}>{item.event}</span>
            </div>
          ))}
        </div>
        <p className="text-xs mt-4 pl-6" style={{ color: 'var(--ink-faint)' }}>
          {t('timelineNote')}
        </p>
      </div>

      {/* Historical photos */}
      <div className="mb-16">
        <p className="label mb-6">{t('photosLabel')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {photos.map((photo, i) => (
            <figure key={i}>
              <div className="relative aspect-[4/3] overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
                <Image src={photoSrcs[i]} alt={photo.caption} fill className="object-cover" />
              </div>
              <figcaption className="text-xs mt-2" style={{ color: 'var(--ink-muted)' }}>{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      {/* Equipment */}
      <div className="mb-16">
        <p className="label mb-6">{t('equipmentLabel')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px" style={{ background: 'var(--line)' }}>
          {equipment.map((eq) => (
            <div
              key={eq.name}
              className="hover-bg p-6"
            >
              <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--ink)' }}>{eq.name}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{eq.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* References */}
      <div className="pt-8" style={{ borderTop: '1px solid var(--line)' }}>
        <p className="label mb-4">{t('refsLabel')}</p>
        <ul className="space-y-2">
          {refs.map((ref) => (
            <li key={ref.href}>
              <a
                href={ref.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover-link text-xs underline underline-offset-2"
              >
                {ref.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
