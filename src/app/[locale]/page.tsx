import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });

  const stats = [
    { num: '1971', label: t('yearFounded') },
    { num: '25 cm', label: t('largestRefractor') },
    { num: '16″', label: t('cassegrain') },
    { num: '2', label: t('celestron') },
  ];

  const services = t.raw('services') as Array<{ title: string; desc: string }>;

  return (
    <div className="page-enter">
      {/* Hero */}
      <section className="relative h-[85vh] min-h-[520px] overflow-hidden">
        <Image
          src="/header.jpg"
          alt="NTHU Observatory"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex flex-col justify-end px-8 pb-16 max-w-5xl mx-auto w-full">
          <p className="text-xs tracking-ultra uppercase text-white/50 mb-4">{t('established')}</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-white tracking-wide leading-tight mb-3">
            {t('title')}
          </h1>
          <p className="text-base text-white/60 font-light tracking-wider mb-8">
            {t('subtitle')}
          </p>
          <div className="flex gap-4">
            <Link
              href={`/${locale}/about`}
              className="inline-block px-6 py-2.5 text-sm tracking-wider border border-white text-white hover:bg-white hover:text-black transition-colors duration-200"
            >
              {t('learnMore')}
            </Link>
            <Link
              href={`/${locale}/visit`}
              className="inline-block px-6 py-2.5 text-sm tracking-wider border border-white/40 text-white/70 hover:border-white hover:text-white transition-colors duration-200"
            >
              {t('planVisit')}
            </Link>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          <div>
            <p className="label mb-4">{t('aboutLabel')}</p>
            <h2 className="text-2xl font-light tracking-wider mb-6 leading-snug" style={{ color: 'var(--ink)' }}>
              {t('aboutHeading')}
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--ink-secondary)' }}>
              {t('aboutP1')}
            </p>
            <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--ink-secondary)' }}>
              {t('aboutP2')}
            </p>
            <Link href={`/${locale}/about`} className="btn">{t('readHistory')}</Link>
          </div>

          <div>
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-baseline gap-5 py-5"
                style={{ borderBottom: '1px solid var(--line)' }}
              >
                <span className="text-2xl font-light w-24 shrink-0" style={{ color: 'var(--ink)' }}>
                  {stat.num}
                </span>
                <span className="text-xs tracking-wider uppercase" style={{ color: 'var(--ink-faint)' }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dome image divider */}
      <section className="relative h-56 overflow-hidden">
        <Image src="/dome_view.png" alt="Observatory dome" fill className="object-cover" />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white/70 text-xs font-light tracking-ultra uppercase">
            {t('exploring')}
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <p className="label mb-4">{t('servicesLabel')}</p>
        <h2 className="text-2xl font-light tracking-wider mb-12" style={{ color: 'var(--ink)' }}>
          {t('servicesHeading')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px" style={{ background: 'var(--line)' }}>
          {services.map((item) => (
            <div
              key={item.title}
              className="hover-bg p-8"
            >
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--ink)' }}>{item.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Visit CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="p-10 md:p-14" style={{ background: 'var(--bg-warm)', border: '1px solid var(--line)' }}>
          <div className="max-w-xl">
            <p className="label mb-4">{t('visitLabel')}</p>
            <h2 className="text-2xl font-light tracking-wider mb-4" style={{ color: 'var(--ink)' }}>
              {t('visitHeading')}
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--ink-secondary)' }}>
              {t('visitDesc')}
            </p>
            <div className="flex gap-4 flex-wrap">
              <Link href={`/${locale}/visit`} className="btn">
                {t('visitCta')}
              </Link>
              <a href="mailto:nthuobs@gmail.com" className="btn-outline">
                {t('contactUs')}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
