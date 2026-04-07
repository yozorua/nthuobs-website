import { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = { title: 'Visit' };

export default async function VisitPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'visit' });
  const notes = t.raw('notes') as string[];

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-14 pb-8" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="label mb-3">{t('label')}</p>
        <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>{t('title')}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Main rules */}
        <div className="md:col-span-2 space-y-10">

          {/* Section 1 */}
          <div>
            <p className="label mb-5">{t('s1Label')}</p>
            <div className="space-y-5">
              <div className="pl-5" style={{ borderLeft: '1px solid var(--line)' }}>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink)' }}>{t('policyTitle')}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
                  {t('policyDesc')}
                </p>
              </div>

              <div className="pl-5" style={{ borderLeft: '1px solid var(--line)' }}>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink)' }}>{t('eligibilityTitle')}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
                  {t('eligibilityDesc')}
                </p>
              </div>

              <div className="pl-5" style={{ borderLeft: '1px solid var(--line)' }}>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink)' }}>{t('timesTitle')}</p>
                <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--ink-secondary)' }}>
                  {t('timesDesc')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3" style={{ background: 'var(--bg-warm)', border: '1px solid var(--line)' }}>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--ink)' }}>{t('afternoon')}</p>
                    <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{t('afternoonHours')}</p>
                  </div>
                  <div className="p-3" style={{ background: 'var(--bg-warm)', border: '1px solid var(--line)' }}>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--ink)' }}>{t('evening')}</p>
                    <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{t('eveningHours')}</p>
                  </div>
                </div>
              </div>

              <div className="pl-5" style={{ borderLeft: '1px solid var(--line)' }}>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink)' }}>{t('durationTitle')}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
                  {t('durationDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div>
            <p className="label mb-5">{t('s2Label')}</p>
            <div className="space-y-5">
              <div className="pl-5" style={{ borderLeft: '1px solid var(--line)' }}>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink)' }}>{t('deadlineTitle')}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
                  {t('deadlineDesc')}
                </p>
              </div>

              <div className="pl-5" style={{ borderLeft: '1px solid var(--line)' }}>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink)' }}>{t('approvalTitle')}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
                  {t('approvalDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div>
            <p className="label mb-5">{t('s3Label')}</p>
            <ul className="space-y-2">
              {notes.map((note, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-xs shrink-0 mt-0.5" style={{ color: 'var(--line-dark)' }}>{i + 1}.</span>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>{note}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Section 4: Location */}
          <div>
            <p className="label mb-5">{t('s4Label')}</p>
            <p className="text-xs mb-1" style={{ color: 'var(--ink)' }}>{t('address')}</p>
            <p className="text-xs mb-1" style={{ color: 'var(--ink-muted)' }}>{t('addressDetail')}</p>
            <p className="text-xs mb-5" style={{ color: 'var(--ink-muted)' }}>{t('elevatorNote')}</p>
            <div className="relative overflow-hidden" style={{ border: '1px solid var(--line)' }}>
              <Image
                src="/campus_map.png"
                alt="NTHU campus map"
                width={800}
                height={500}
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Section 5: Transportation */}
          <div>
            <p className="label mb-5">{t('s5Label')}</p>
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium mb-3" style={{ color: 'var(--ink)' }}>{t('byCarTitle')}</p>
                <div className="space-y-2 pl-4" style={{ borderLeft: '1px solid var(--line)' }}>
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--ink-secondary)' }}>{t('hw1Title')}</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{t('hw1Desc')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--ink-secondary)' }}>{t('hw3Title')}</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{t('hw3Desc')}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium mb-3" style={{ color: 'var(--ink)' }}>{t('byTransitTitle')}</p>
                <div className="space-y-2 pl-4" style={{ borderLeft: '1px solid var(--line)' }}>
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--ink-secondary)' }}>{t('trainTitle')}</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{t('trainDesc')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--ink-secondary)' }}>{t('busTitle')}</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{t('busDesc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Application links */}
          <div className="p-5" style={{ border: '1px solid var(--line)' }}>
            <p className="label mb-4">{t('applyLabel')}</p>
            <div className="space-y-3">
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLScgXImCypCFFM2owN1xkqrHmqughDZLAi2slBWZCy_9kTcSUA/viewform"
                target="_blank"
                rel="noopener noreferrer"
                className="btn block text-center text-xs"
              >
                {t('regForm')}
              </a>
              <a
                href="https://docs.google.com/document/d/1LO9ziHvkIQU_VpilwPQuHeRXhEjTtCMjEV4tmP-R8zw/edit"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline block text-center text-xs"
              >
                {t('visitRules')}
              </a>
            </div>
          </div>

          {/* Contact */}
          <div className="p-5" style={{ border: '1px solid var(--line)' }}>
            <p className="label mb-4">{t('questionsLabel')}</p>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--ink-secondary)' }}>
              {t('questionsDesc')}
            </p>
            <a
              href="mailto:nthuobs@gmail.com"
              className="text-xs underline underline-offset-2 transition-colors"
              style={{ color: 'var(--ink)' }}
            >
              nthuobs@gmail.com
            </a>
          </div>

          {/* Rules enacted date */}
          <div className="p-5" style={{ border: '1px solid var(--line)' }}>
            <p className="label mb-3">{t('rulesLabel')}</p>
            <p className="text-xs" style={{ color: 'var(--ink-secondary)' }}>{t('rulesDate')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
              {t('rulesPassed')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
